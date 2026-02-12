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

    // Get all plays within range
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: startDate, lte: endDate },
      },
      include: {
        track: true,
        artist: true,
      },
      orderBy: { playedAt: "asc" },
    });

    if (plays.length === 0) {
      return NextResponse.json({
        monthlyGenreData: [],
        genreRankings: [],
        topGenresOverTime: [],
        newlyDiscoveredGenres: [],
        decliningGenres: [],
        risingGenres: [],
      });
    }

    // Group plays by month and genre
    const monthlyGenres: Record<string, Record<string, { totalMs: number; playCount: number; firstPlay?: Date }>> = {};
    const genreFirstPlay: Record<string, Date> = {};

    for (const play of plays) {
      const month = play.playedAt.toISOString().slice(0, 7); // YYYY-MM

      if (!monthlyGenres[month]) {
        monthlyGenres[month] = {};
      }

      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          for (const genre of genres) {
            if (!monthlyGenres[month][genre]) {
              monthlyGenres[month][genre] = { totalMs: 0, playCount: 0 };
            }
            monthlyGenres[month][genre].totalMs += play.track.durationMs;
            monthlyGenres[month][genre].playCount++;

            // Track first play of each genre
            if (!genreFirstPlay[genre] || play.playedAt < genreFirstPlay[genre]) {
              genreFirstPlay[genre] = play.playedAt;
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    // Convert to array format for charts
    const sortedMonths = Object.keys(monthlyGenres).sort();

    // Get all unique genres
    const allGenres = new Set<string>();
    for (const monthData of Object.values(monthlyGenres)) {
      for (const genre of Object.keys(monthData)) {
        allGenres.add(genre);
      }
    }

    // Calculate monthly genre data with percentages
    const monthlyGenreData = sortedMonths.map((month) => {
      const genreData = monthlyGenres[month];
      const totalMs = Object.values(genreData).reduce((sum, g) => sum + g.totalMs, 0);

      const genres: Record<string, number> = {};
      const genresMs: Record<string, number> = {};

      for (const [genre, data] of Object.entries(genreData)) {
        genres[genre] = totalMs > 0 ? (data.totalMs / totalMs) * 100 : 0;
        genresMs[genre] = data.totalMs;
      }

      return {
        month,
        totalMs,
        ...genres,
        _raw: genresMs,
      };
    });

    // Calculate genre rankings for each month
    const genreRankings: Record<string, { month: string; rank: number; percentage: number }[]> = {};

    for (const monthData of monthlyGenreData) {
      const month = monthData.month;
      const genrePercentages: { genre: string; percentage: number }[] = [];

      for (const [key, value] of Object.entries(monthData)) {
        if (key !== "month" && key !== "totalMs" && key !== "_raw" && typeof value === "number") {
          genrePercentages.push({ genre: key, percentage: value });
        }
      }

      genrePercentages.sort((a, b) => b.percentage - a.percentage);

      genrePercentages.forEach((item, index) => {
        if (!genreRankings[item.genre]) {
          genreRankings[item.genre] = [];
        }
        genreRankings[item.genre].push({
          month,
          rank: index + 1,
          percentage: Math.round(item.percentage * 100) / 100,
        });
      });
    }

    // Get top 10 genres overall for the evolution chart
    const genreTotals: Record<string, number> = {};
    for (const monthData of Object.values(monthlyGenres)) {
      for (const [genre, data] of Object.entries(monthData)) {
        genreTotals[genre] = (genreTotals[genre] || 0) + data.totalMs;
      }
    }

    const topGenres = Object.entries(genreTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre]) => genre);

    // Format top genres over time for stacked area chart
    const topGenresOverTime = sortedMonths.map((month) => {
      const result: Record<string, number | string> = { month };
      const totalMs = Object.values(monthlyGenres[month] || {}).reduce((sum, g) => sum + g.totalMs, 0);

      for (const genre of topGenres) {
        const genreMs = monthlyGenres[month]?.[genre]?.totalMs || 0;
        result[genre] = totalMs > 0 ? (genreMs / totalMs) * 100 : 0;
      }

      return result;
    });

    // Find newly discovered genres (first appeared in recent months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const newlyDiscoveredGenres = Object.entries(genreFirstPlay)
      .filter(([, date]) => date >= threeMonthsAgo)
      .map(([genre, date]) => ({
        genre,
        discoveredAt: date.toISOString(),
        totalMs: genreTotals[genre] || 0,
      }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 10);

    // Calculate rising and declining genres
    const recentMonths = sortedMonths.slice(-3);
    const olderMonths = sortedMonths.slice(-6, -3);

    const calculateAvgPercentage = (genre: string, months: string[]): number => {
      let total = 0;
      let count = 0;
      for (const month of months) {
        const totalMs = Object.values(monthlyGenres[month] || {}).reduce((sum, g) => sum + g.totalMs, 0);
        const genreMs = monthlyGenres[month]?.[genre]?.totalMs || 0;
        if (totalMs > 0) {
          total += (genreMs / totalMs) * 100;
          count++;
        }
      }
      return count > 0 ? total / count : 0;
    };

    const genreChanges = Array.from(allGenres).map((genre) => {
      const recentAvg = calculateAvgPercentage(genre, recentMonths);
      const olderAvg = calculateAvgPercentage(genre, olderMonths);
      return {
        genre,
        recentAvg: Math.round(recentAvg * 100) / 100,
        olderAvg: Math.round(olderAvg * 100) / 100,
        change: Math.round((recentAvg - olderAvg) * 100) / 100,
      };
    });

    const risingGenres = genreChanges
      .filter((g) => g.change > 0 && g.recentAvg > 1)
      .sort((a, b) => b.change - a.change)
      .slice(0, 5);

    const decliningGenres = genreChanges
      .filter((g) => g.change < 0 && g.olderAvg > 1)
      .sort((a, b) => a.change - b.change)
      .slice(0, 5);

    return NextResponse.json({
      monthlyGenreData,
      genreRankings,
      topGenres,
      topGenresOverTime,
      newlyDiscoveredGenres,
      decliningGenres,
      risingGenres,
    });
  } catch (error) {
    console.error("Genre Evolution API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
