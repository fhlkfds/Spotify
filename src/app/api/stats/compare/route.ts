import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's plays from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userPlays = await prisma.play.findMany({
      where: { userId, playedAt: { gte: thirtyDaysAgo } },
      include: { track: true, artist: true },
    });

    // Calculate user stats
    const userTotalMs = userPlays.reduce((sum, p) => sum + p.track.durationMs, 0);
    const userHoursPerWeek = (userTotalMs / (1000 * 60 * 60)) / 4.3; // ~4.3 weeks per month

    const uniqueArtists = new Set(userPlays.map((p) => p.artistId)).size;
    const uniqueTracks = new Set(userPlays.map((p) => p.trackId)).size;

    // Get global stats
    const globalStats = await prisma.globalStats.findUnique({
      where: { id: "global" },
    });

    // Calculate percentiles by comparing with other users
    const allUsers = await prisma.user.findMany({
      include: {
        plays: {
          where: { playedAt: { gte: thirtyDaysAgo } },
          include: { track: true },
        },
      },
    });

    const userListeningTimes = allUsers
      .map((u) => ({
        userId: u.id,
        totalMs: u.plays.reduce((sum, p) => sum + p.track.durationMs, 0),
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    const userRank = userListeningTimes.findIndex((u) => u.userId === userId) + 1;
    const percentile = Math.round(
      ((userListeningTimes.length - userRank) / userListeningTimes.length) * 100
    );

    // Genre diversity score (number of unique genres / max possible)
    const userGenres = new Set<string>();
    for (const play of userPlays) {
      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          genres.forEach((g) => userGenres.add(g));
        } catch {}
      }
    }

    // Discovery score (new artists in last 30 days vs total)
    const allUserPlays = await prisma.play.findMany({
      where: { userId },
      select: { artistId: true, playedAt: true },
    });

    const allArtistIds = new Set(allUserPlays.map((p) => p.artistId));
    const recentArtistIds = new Set(userPlays.map((p) => p.artistId));

    const artistsBeforeThirtyDays = new Set(
      allUserPlays
        .filter((p) => p.playedAt < thirtyDaysAgo)
        .map((p) => p.artistId)
    );

    const newArtists = Array.from(recentArtistIds).filter(
      (id) => !artistsBeforeThirtyDays.has(id)
    ).length;

    const discoveryScore = Math.min(
      100,
      Math.round((newArtists / Math.max(recentArtistIds.size, 1)) * 100)
    );

    return NextResponse.json({
      userStats: {
        totalMs: userTotalMs,
        hoursPerWeek: userHoursPerWeek,
        uniqueArtists,
        uniqueTracks,
        genreCount: userGenres.size,
        discoveryScore,
      },
      comparison: {
        percentile,
        rank: userRank,
        totalUsers: userListeningTimes.length,
        avgHoursPerWeek: globalStats?.avgHoursPerWeek || 0,
      },
      globalStats: {
        totalUsers: globalStats?.totalUsers || allUsers.length,
        avgHoursPerWeek: globalStats?.avgHoursPerWeek || 0,
        topGenres: globalStats?.topGenres
          ? JSON.parse(globalStats.topGenres)
          : [],
      },
    });
  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
