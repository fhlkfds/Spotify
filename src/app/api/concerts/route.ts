import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Simulated concert data based on user's top artists
// In production, you'd integrate with Ticketmaster, Songkick, or Bandsintown API

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
  distance: number; // miles from user location
}

// Major cities with mock venue data
const VENUES: Record<string, { name: string; city: string; state: string }[]> = {
  "new york": [
    { name: "Madison Square Garden", city: "New York", state: "NY" },
    { name: "Barclays Center", city: "Brooklyn", state: "NY" },
    { name: "Radio City Music Hall", city: "New York", state: "NY" },
    { name: "Terminal 5", city: "New York", state: "NY" },
  ],
  "los angeles": [
    { name: "The Forum", city: "Inglewood", state: "CA" },
    { name: "Hollywood Bowl", city: "Los Angeles", state: "CA" },
    { name: "The Wiltern", city: "Los Angeles", state: "CA" },
    { name: "Greek Theatre", city: "Los Angeles", state: "CA" },
  ],
  "chicago": [
    { name: "United Center", city: "Chicago", state: "IL" },
    { name: "Soldier Field", city: "Chicago", state: "IL" },
    { name: "House of Blues", city: "Chicago", state: "IL" },
  ],
  "london": [
    { name: "O2 Arena", city: "London", state: "UK" },
    { name: "Wembley Stadium", city: "London", state: "UK" },
    { name: "Brixton Academy", city: "London", state: "UK" },
  ],
  "default": [
    { name: "City Arena", city: "Your City", state: "" },
    { name: "Downtown Amphitheater", city: "Your City", state: "" },
    { name: "The Music Hall", city: "Your City", state: "" },
  ],
};

function getVenuesForLocation(location: string): { name: string; city: string; state: string }[] {
  const normalizedLocation = location.toLowerCase();

  for (const [key, venues] of Object.entries(VENUES)) {
    if (normalizedLocation.includes(key)) {
      return venues;
    }
  }

  return VENUES.default.map(v => ({
    ...v,
    city: location.split(",")[0] || "Your City",
  }));
}

function generateMockConcert(
  artist: { id: string; name: string; imageUrl: string | null },
  venue: { name: string; city: string; state: string },
  daysFromNow: number
): Concert {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);

  const prices = ["$45", "$65", "$85", "$125", "$175", "$250"];
  const times = ["7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"];

  return {
    id: `${artist.id}-${daysFromNow}-${venue.name.replace(/\s+/g, "-")}`,
    artistId: artist.id,
    artistName: artist.name,
    artistImageUrl: artist.imageUrl,
    eventName: `${artist.name} Live`,
    venue: venue.name,
    city: venue.state ? `${venue.city}, ${venue.state}` : venue.city,
    date: date.toISOString().split("T")[0],
    time: times[Math.floor(Math.random() * times.length)],
    price: prices[Math.floor(Math.random() * prices.length)],
    ticketUrl: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist.name)}`,
    distance: Math.floor(Math.random() * 50) + 5,
  };
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

    // Get venues for location
    const venues = getVenuesForLocation(location);

    // Generate mock concerts for top artists
    const concerts: Concert[] = [];

    for (const artist of topArtists.slice(0, 10)) {
      // Each artist might have 0-2 concerts in the next 90 days
      const numConcerts = Math.floor(Math.random() * 3);

      for (let i = 0; i < numConcerts; i++) {
        const daysFromNow = Math.floor(Math.random() * 90) + 7;
        const venue = venues[Math.floor(Math.random() * venues.length)];
        concerts.push(generateMockConcert(artist, venue, daysFromNow));
      }
    }

    // Sort by date
    concerts.sort((a, b) => a.date.localeCompare(b.date));

    // Group by month
    const concertsByMonth: Record<string, Concert[]> = {};
    for (const concert of concerts) {
      const month = new Date(concert.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!concertsByMonth[month]) {
        concertsByMonth[month] = [];
      }
      concertsByMonth[month].push(concert);
    }

    return NextResponse.json({
      location,
      concerts,
      concertsByMonth,
      totalConcerts: concerts.length,
      artistsWithConcerts: new Set(concerts.map(c => c.artistId)).size,
    });
  } catch (error) {
    console.error("Concerts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
