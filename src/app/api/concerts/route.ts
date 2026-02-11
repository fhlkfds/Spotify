import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface Concert {
  id: string;
  artistId: string;
  artistName: string;
  artistImageUrl: string | null;
  eventName: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  price: string;
  ticketUrl: string;
  distance: number | null; // miles from user location when available
}


function formatPriceRange(priceRange?: { min?: number; max?: number; currency?: string }) {
  if (!priceRange || priceRange.min == null) {
    return "See site";
  }
  const currency = priceRange.currency || "USD";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  if (priceRange.max != null && priceRange.max !== priceRange.min) {
    return `${symbol}${Math.round(priceRange.min)}-${Math.round(priceRange.max)}`;
  }
  return `${symbol}${Math.round(priceRange.min)}+`;
}

function parseLocation(location: string) {
  const parts = location.split(",").map(part => part.trim()).filter(Boolean);
  const city = parts[0] || "";
  const stateCode = parts[1] && parts[1].length === 2 ? parts[1].toUpperCase() : "";
  return { city, stateCode };
}

function getEventDistance(event: {
  distance?: number;
  _embedded?: { venues?: Array<{ distance?: { value?: number } }> };
}) {
  if (typeof event.distance === "number") {
    return Math.round(event.distance);
  }
  const venueDistance = event._embedded?.venues?.[0]?.distance?.value;
  if (typeof venueDistance === "number") {
    return Math.round(venueDistance);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location") || "New York, NY";
    const radiusMiles = Number(searchParams.get("radiusMiles") || "100");
    const normalizedRadiusMiles = Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 100;
    const apiKey = process.env.TICKETMASTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Ticketmaster API key is not configured." },
        { status: 500 }
      );
    }

    // Get user's top artists
    const plays = await prisma.play.findMany({
      where: { userId },
      include: { artist: true },
    });

    // Calculate top artists by play count
    const artistStats: Record<string, { id: string; name: string; imageUrl: string | null; playCount: number }> = {};

    for (const play of plays) {
      if (!artistStats[play.artistId]) {
        artistStats[play.artistId] = {
          id: play.artistId,
          name: play.artist.name,
          imageUrl: play.artist.imageUrl,
          playCount: 0,
        };
      }
      artistStats[play.artistId].playCount++;
    }

    const topArtists = Object.values(artistStats)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 20);

    if (topArtists.length === 0) {
      return NextResponse.json({
        concerts: [],
        message: "No listening history found. Sync your data to get concert recommendations.",
      });
    }

    const { city, stateCode } = parseLocation(location);
    const startDateTime = new Date();
    const endDateTime = new Date();
    endDateTime.setDate(endDateTime.getDate() + 180);

    const concertsById = new Map<string, Concert>();
    const artistSearches = topArtists.slice(0, 8);

    await Promise.allSettled(
      artistSearches.map(async (artist) => {
        try {
          const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
          url.searchParams.set("apikey", apiKey);
          url.searchParams.set("keyword", artist.name);
          url.searchParams.set("classificationName", "music");
          url.searchParams.set("radius", normalizedRadiusMiles.toString());
          url.searchParams.set("unit", "miles");
          url.searchParams.set("size", "20");
          url.searchParams.set("sort", "date,asc");
          url.searchParams.set("startDateTime", startDateTime.toISOString());
          url.searchParams.set("endDateTime", endDateTime.toISOString());
          url.searchParams.set("locale", "*");
          if (city) {
            url.searchParams.set("city", city);
          }
          if (stateCode) {
            url.searchParams.set("stateCode", stateCode);
          }

          const res = await fetch(url.toString(), { next: { revalidate: 300 } });
          if (!res.ok) {
            return;
          }
          const payload = await res.json();
          const events = payload?._embedded?.events ?? [];

          for (const event of events) {
            if (!event?.id || concertsById.has(event.id)) {
              continue;
            }
            const venue = event?._embedded?.venues?.[0];
            const venueName = venue?.name || "Venue TBA";
            const venueCity = venue?.city?.name || "";
            const venueState = venue?.state?.stateCode || venue?.country?.countryCode || "";
            const cityLabel = venueState ? `${venueCity}, ${venueState}` : venueCity;
            const localDate = event?.dates?.start?.localDate || "";
            if (!localDate) {
              continue;
            }

            concertsById.set(event.id, {
              id: event.id,
              artistId: artist.id,
              artistName: artist.name,
              artistImageUrl: artist.imageUrl,
              eventName: event.name || `${artist.name} Live`,
              venue: venueName,
              city: cityLabel || location,
              date: localDate,
              time: event?.dates?.start?.localTime || "TBA",
              price: formatPriceRange(event?.priceRanges?.[0]),
              ticketUrl: event?.url || `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist.name)}`,
              distance: getEventDistance(event),
            });
          }
        } catch (error) {
          console.error("Ticketmaster lookup failed:", error);
        }
      })
    );

    const filteredConcerts = Array.from(concertsById.values()).filter(concert => {
      if (concert.distance == null) {
        return true;
      }
      return concert.distance <= normalizedRadiusMiles;
    });

    // Sort by date
    filteredConcerts.sort((a, b) => a.date.localeCompare(b.date));

    // Group by month
    const concertsByMonth: Record<string, Concert[]> = {};
    for (const concert of filteredConcerts) {
      const month = new Date(concert.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!concertsByMonth[month]) {
        concertsByMonth[month] = [];
      }
      concertsByMonth[month].push(concert);
    }

    return NextResponse.json({
      location,
      radiusMiles: normalizedRadiusMiles,
      concerts: filteredConcerts,
      concertsByMonth,
      totalConcerts: filteredConcerts.length,
      artistsWithConcerts: new Set(filteredConcerts.map(c => c.artistId)).size,
    });
  } catch (error) {
    console.error("Concerts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
