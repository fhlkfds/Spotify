import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDateRangeFromSearchParams } from "@/lib/utils";

const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = getDateRangeFromSearchParams(searchParams);

    // Load only required fields for genre aggregation.
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: startDate, lte: endDate },
      },
      select: {
        artistId: true,
        track: { select: { durationMs: true } },
      },
    });

    const uniqueArtistIds = Array.from(new Set(plays.map((play) => play.artistId)));
    const artists = uniqueArtistIds.length
      ? await prisma.artist.findMany({
          where: { id: { in: uniqueArtistIds } },
          select: { id: true, genres: true },
        })
      : [];

    const artistGenres = new Map<string, string[]>();
    for (const artist of artists) {
      if (!artist.genres) {
        continue;
      }
      try {
        const parsedGenres = JSON.parse(artist.genres) as string[];
        artistGenres.set(artist.id, parsedGenres);
      } catch {
        // Invalid JSON, skip
      }
    }

    // Build genre statistics
    const genreData: Record<
      string,
      {
        playCount: number;
        totalMs: number;
        artistIds: Set<string>;
      }
    > = {};

    for (const play of plays) {
      const genres = artistGenres.get(play.artistId);
      if (!genres) {
        continue;
      }
      for (const genre of genres) {
        if (!genreData[genre]) {
          genreData[genre] = {
            playCount: 0,
            totalMs: 0,
            artistIds: new Set(),
          };
        }
        genreData[genre].playCount++;
        genreData[genre].totalMs += play.track.durationMs;
        genreData[genre].artistIds.add(play.artistId);
      }
    }

    // Convert to array and sort by listening time
    const topGenres = Object.entries(genreData)
      .map(([genre, data]) => ({
        genre,
        playCount: data.playCount,
        totalMs: data.totalMs,
        artistCount: data.artistIds.size,
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    // Calculate diversity metrics
    const totalGenres = topGenres.length;
    const topGenre = topGenres[0]?.genre || null;
    const totalListeningMs = topGenres.reduce((sum, g) => sum + g.totalMs, 0);

    // Shannon diversity index (normalized)
    let diversityScore = 0;
    if (totalListeningMs > 0 && topGenres.length > 1) {
      let entropy = 0;
      for (const genre of topGenres) {
        const p = genre.totalMs / totalListeningMs;
        if (p > 0) {
          entropy -= p * Math.log(p);
        }
      }
      // Normalize to 0-100 scale
      const maxEntropy = Math.log(topGenres.length);
      diversityScore = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    }

    return NextResponse.json({
      topGenres,
      stats: {
        totalGenres,
        topGenre,
        diversityScore,
        totalListeningMs,
      },
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Genres API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
