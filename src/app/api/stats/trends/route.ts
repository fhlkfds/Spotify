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
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all plays within range
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: startDate },
      },
      include: { track: true },
      orderBy: { playedAt: "asc" },
    });

    // Group by day
    const dailyData: Record<string, { totalMs: number; playCount: number }> =
      {};
    for (const play of plays) {
      const date = play.playedAt.toISOString().split("T")[0];
      if (!dailyData[date]) {
        dailyData[date] = { totalMs: 0, playCount: 0 };
      }
      dailyData[date].totalMs += play.track.durationMs;
      dailyData[date].playCount++;
    }

    const dailyListening = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        totalMs: data.totalMs,
        playCount: data.playCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by hour
    const hourlyData: Record<number, { totalMs: number; playCount: number }> =
      {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { totalMs: 0, playCount: 0 };
    }
    for (const play of plays) {
      const hour = play.playedAt.getHours();
      hourlyData[hour].totalMs += play.track.durationMs;
      hourlyData[hour].playCount++;
    }

    const hourlyDistribution = Object.entries(hourlyData).map(
      ([hour, data]) => ({
        hour: parseInt(hour),
        totalMs: data.totalMs,
        playCount: data.playCount,
      })
    );

    // Calculate streak
    const uniqueDays = Array.from(new Set(plays.map((p) => p.playedAt.toISOString().split("T")[0]))).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < uniqueDays.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expected = expectedDate.toISOString().split("T")[0];

      if (uniqueDays.includes(expected)) {
        streak++;
      } else if (i === 0 && uniqueDays[0] !== today) {
        // If no plays today, check from yesterday
        continue;
      } else {
        break;
      }
    }

    // Heatmap data for the last year
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const heatmapData: { date: string; count: number }[] = [];
    const heatmapMap = new Map<string, number>();

    for (const play of plays) {
      const date = play.playedAt.toISOString().split("T")[0];
      heatmapMap.set(date, (heatmapMap.get(date) || 0) + 1);
    }

    heatmapMap.forEach((count, date) => {
      heatmapData.push({ date, count });
    });

    return NextResponse.json({
      dailyListening,
      hourlyDistribution,
      streak,
      heatmapData,
    });
  } catch (error) {
    console.error("Trends API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
