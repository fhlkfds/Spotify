import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDateRangeFromSearchParams } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = getDateRangeFromSearchParams(searchParams);

    // Get all plays with artist data
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: startDate, lte: endDate },
      },
      include: {
        track: true,
        artist: true,
      },
    });

    if (plays.length === 0) {
      return NextResponse.json({
        scores: {
          overall: 0,
          genreDiversity: 0,
          artistDiversity: 0,
          explorationScore: 0,
          mainstreamScore: 0,
          nicheScore: 0,
        },
        breakdown: {
          totalGenres: 0,
          totalArtists: 0,
          totalPlays: 0,
          avgGenresPerArtist: 0,
          topGenreConcentration: 0,
          top5GenreConcentration: 0,
        },
        genreDistribution: [],
        artistDistribution: [],
        diversityTrend: [],
      });
    }

    // Build genre statistics
    const genreData: Record<string, { playCount: number; totalMs: number; artistIds: Set<string> }> = {};
    const artistData: Record<string, { playCount: number; totalMs: number; genres: Set<string> }> = {};

    for (const play of plays) {
      // Track artist stats
      if (!artistData[play.artistId]) {
        artistData[play.artistId] = { playCount: 0, totalMs: 0, genres: new Set() };
      }
      artistData[play.artistId].playCount++;
      artistData[play.artistId].totalMs += play.track.durationMs;

      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          for (const genre of genres) {
            artistData[play.artistId].genres.add(genre);
            if (!genreData[genre]) {
              genreData[genre] = { playCount: 0, totalMs: 0, artistIds: new Set() };
            }
            genreData[genre].playCount++;
            genreData[genre].totalMs += play.track.durationMs;
            genreData[genre].artistIds.add(play.artistId);
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    const totalListeningMs = plays.reduce((sum, p) => sum + p.track.durationMs, 0);
    const totalGenres = Object.keys(genreData).length;
    const totalArtists = Object.keys(artistData).length;

    // Sort genres by listening time
    const sortedGenres = Object.entries(genreData)
      .map(([genre, data]) => ({
        genre,
        playCount: data.playCount,
        totalMs: data.totalMs,
        artistCount: data.artistIds.size,
        percentage: (data.totalMs / totalListeningMs) * 100,
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    // Sort artists by listening time
    const sortedArtists = Object.entries(artistData)
      .map(([artistId, data]) => ({
        artistId,
        playCount: data.playCount,
        totalMs: data.totalMs,
        genreCount: data.genres.size,
        percentage: (data.totalMs / totalListeningMs) * 100,
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    // 1. Shannon Diversity Index for Genres (normalized 0-100)
    let genreDiversity = 0;
    if (totalListeningMs > 0 && sortedGenres.length > 1) {
      let entropy = 0;
      for (const genre of sortedGenres) {
        const p = genre.totalMs / totalListeningMs;
        if (p > 0) {
          entropy -= p * Math.log(p);
        }
      }
      const maxEntropy = Math.log(sortedGenres.length);
      genreDiversity = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;
    }

    // 2. Shannon Diversity Index for Artists (normalized 0-100)
    let artistDiversity = 0;
    if (totalListeningMs > 0 && sortedArtists.length > 1) {
      let entropy = 0;
      for (const artist of sortedArtists) {
        const p = artist.totalMs / totalListeningMs;
        if (p > 0) {
          entropy -= p * Math.log(p);
        }
      }
      const maxEntropy = Math.log(sortedArtists.length);
      artistDiversity = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;
    }

    // 3. Exploration Score - based on how many genres you've touched relative to potential
    // More genres discovered = higher exploration
    const maxExpectedGenres = 150; // Spotify has ~1500+ genres, but 150 is diverse
    const explorationScore = Math.min((totalGenres / maxExpectedGenres) * 100, 100);

    // 4. Genre concentration metrics
    const topGenreConcentration = sortedGenres[0]?.percentage || 0;
    const top5Genres = sortedGenres.slice(0, 5);
    const top5GenreConcentration = top5Genres.reduce((sum, g) => sum + g.percentage, 0);

    // 5. Niche Score - inverse of mainstream concentration
    // If top genres are less dominant, you're more niche
    const nicheScore = Math.max(0, 100 - topGenreConcentration * 2);

    // 6. Mainstream Score - how concentrated your listening is
    const mainstreamScore = Math.min(topGenreConcentration * 2, 100);

    // 7. Overall diversity score (weighted average)
    const overall =
      genreDiversity * 0.35 +
      artistDiversity * 0.35 +
      explorationScore * 0.15 +
      nicheScore * 0.15;

    // Calculate average genres per artist
    const avgGenresPerArtist = sortedArtists.length > 0
      ? sortedArtists.reduce((sum, a) => sum + a.genreCount, 0) / sortedArtists.length
      : 0;

    // Calculate diversity trend over months
    const monthlyPlays: Record<string, { genres: Set<string>; artists: Set<string>; totalMs: number }> = {};

    for (const play of plays) {
      const month = play.playedAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyPlays[month]) {
        monthlyPlays[month] = { genres: new Set(), artists: new Set(), totalMs: 0 };
      }
      monthlyPlays[month].artists.add(play.artistId);
      monthlyPlays[month].totalMs += play.track.durationMs;

      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          for (const genre of genres) {
            monthlyPlays[month].genres.add(genre);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    const diversityTrend = Object.entries(monthlyPlays)
      .map(([month, data]) => ({
        month,
        genreCount: data.genres.size,
        artistCount: data.artists.size,
        totalMs: data.totalMs,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      scores: {
        overall: Math.round(overall),
        genreDiversity: Math.round(genreDiversity),
        artistDiversity: Math.round(artistDiversity),
        explorationScore: Math.round(explorationScore),
        mainstreamScore: Math.round(mainstreamScore),
        nicheScore: Math.round(nicheScore),
      },
      breakdown: {
        totalGenres,
        totalArtists,
        totalPlays: plays.length,
        avgGenresPerArtist: Math.round(avgGenresPerArtist * 10) / 10,
        topGenreConcentration: Math.round(topGenreConcentration * 10) / 10,
        top5GenreConcentration: Math.round(top5GenreConcentration * 10) / 10,
      },
      genreDistribution: sortedGenres.slice(0, 20),
      artistDistribution: sortedArtists.slice(0, 10),
      diversityTrend,
    });
  } catch (error) {
    console.error("Diversity API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
