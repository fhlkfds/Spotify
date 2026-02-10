import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SpotifyClient, refreshAccessToken } from "@/lib/spotify";
import type { RecommendedTrack, RecommendedArtist } from "@/types";

/**
 * Find similar artists based on the user's listening patterns.
 * Artists that are frequently listened to around the same time are considered similar.
 */
async function getSimilarArtistsFromListeningHistory(
  userId: string,
  artistId: string,
  limit: number = 10
): Promise<RecommendedArtist[]> {
  // Get plays of the target artist
  const artistPlays = await prisma.play.findMany({
    where: {
      userId,
      artistId,
    },
    select: {
      playedAt: true,
    },
    orderBy: {
      playedAt: "desc",
    },
    take: 100, // Use last 100 plays to find patterns
  });

  if (artistPlays.length === 0) {
    return [];
  }

  // For each play, find other artists played within a 2-hour window
  const timeWindowMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  // Build date ranges for the query
  const dateRanges = artistPlays.map((play) => ({
    gte: new Date(play.playedAt.getTime() - timeWindowMs),
    lte: new Date(play.playedAt.getTime() + timeWindowMs),
  }));

  // Find all plays within those time windows (excluding the target artist)
  const relatedPlays = await prisma.play.findMany({
    where: {
      userId,
      artistId: { not: artistId },
      OR: dateRanges.map((range) => ({
        playedAt: range,
      })),
    },
    select: {
      artistId: true,
    },
  });

  // Count occurrences of each artist
  const artistCounts = new Map<string, number>();
  for (const play of relatedPlays) {
    artistCounts.set(play.artistId, (artistCounts.get(play.artistId) || 0) + 1);
  }

  // Sort by count and take top artists
  const topArtistIds = Array.from(artistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topArtistIds.length === 0) {
    return [];
  }

  // Fetch artist details
  const artists = await prisma.artist.findMany({
    where: {
      id: { in: topArtistIds },
    },
  });

  // Sort artists by their count and map to response format
  const artistMap = new Map(artists.map((a) => [a.id, a]));
  return topArtistIds
    .map((id) => {
      const artist = artistMap.get(id);
      if (!artist) return null;
      const genres = artist.genres ? JSON.parse(artist.genres) : [];
      return {
        id: artist.id,
        name: artist.name,
        imageUrl: artist.imageUrl,
        genres: genres.slice(0, 3),
        spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
      };
    })
    .filter((a): a is RecommendedArtist => a !== null);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "track" or "artist"
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing type or id parameter" },
        { status: 400 }
      );
    }

    if (type !== "track" && type !== "artist") {
      return NextResponse.json(
        { error: "Type must be 'track' or 'artist'" },
        { status: 400 }
      );
    }

    // Get user's Spotify account
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "spotify",
      },
    });

    if (!account?.access_token || !account?.refresh_token) {
      return NextResponse.json(
        { error: "Spotify account not connected" },
        { status: 400 }
      );
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (account.expires_at && Date.now() >= account.expires_at * 1000) {
      try {
        const refreshed = await refreshAccessToken(account.refresh_token);
        accessToken = refreshed.access_token;

        // Update stored tokens
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: refreshed.access_token,
            expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
            refresh_token: refreshed.refresh_token || account.refresh_token,
          },
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to refresh Spotify token" },
          { status: 401 }
        );
      }
    }

    const spotify = new SpotifyClient(accessToken);

    if (type === "track") {
      // Get similar tracks by searching for other tracks by the same artist
      // Note: Spotify deprecated /recommendations endpoint in Nov 2024
      const similar = await spotify.getSimilarTracks(id, 10);

      const tracks: RecommendedTrack[] = similar.tracks.map((track) => ({
        id: track.id,
        name: track.name,
        artistName: track.artists.map((a) => a.name).join(", "),
        albumName: track.album.name,
        albumImageUrl: track.album.images[0]?.url || null,
        durationMs: track.duration_ms,
        spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      }));

      return NextResponse.json({ recommendations: tracks });
    } else {
      // First, try to get similar artists from the user's listening history
      // This finds artists they frequently listen to around the same time
      const historyBasedArtists = await getSimilarArtistsFromListeningHistory(
        session.user.id,
        id,
        10
      );

      if (historyBasedArtists.length > 0) {
        return NextResponse.json({ recommendations: historyBasedArtists });
      }

      // Fallback: Search for artists in the same genres via Spotify API
      // Note: Spotify deprecated /artists/{id}/related-artists endpoint in Nov 2024
      const similar = await spotify.getSimilarArtists(id, 10);

      const artists: RecommendedArtist[] = similar.artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        imageUrl: artist.images[0]?.url || null,
        genres: artist.genres.slice(0, 3),
        spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
      }));

      return NextResponse.json({ recommendations: artists });
    }
  } catch (error) {
    console.error("Recommendations API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
