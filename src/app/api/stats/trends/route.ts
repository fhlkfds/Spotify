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

    const [dailyRows, hourlyRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{ date: string; total_ms: number; play_count: number }>
      >`
        SELECT
          DATE("Play"."playedAt") AS date,
          COALESCE(SUM("Track"."durationMs"), 0) AS total_ms,
          COUNT(*) AS play_count
        FROM "Play"
        INNER JOIN "Track" ON "Track"."id" = "Play"."trackId"
        WHERE
          "Play"."userId" = ${userId}
          AND "Play"."playedAt" >= ${startDate}
          AND "Play"."playedAt" <= ${endDate}
        GROUP BY DATE("Play"."playedAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw<
        Array<{ hour: number; total_ms: number; play_count: number }>
      >`
        SELECT
          CAST(STRFTIME('%H', "Play"."playedAt") AS INTEGER) AS hour,
          COALESCE(SUM("Track"."durationMs"), 0) AS total_ms,
          COUNT(*) AS play_count
        FROM "Play"
        INNER JOIN "Track" ON "Track"."id" = "Play"."trackId"
        WHERE
          "Play"."userId" = ${userId}
          AND "Play"."playedAt" >= ${startDate}
          AND "Play"."playedAt" <= ${endDate}
        GROUP BY hour
        ORDER BY hour ASC
      `,
    ]);

    const dailyListening = dailyRows.map((row) => ({
      date: row.date,
      totalMs: Number(row.total_ms),
      playCount: Number(row.play_count),
    }));

    const hourlyMap = new Map(
      hourlyRows.map((row) => [
        Number(row.hour),
        { totalMs: Number(row.total_ms), playCount: Number(row.play_count) },
      ])
    );

    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const data = hourlyMap.get(hour) || { totalMs: 0, playCount: 0 };
      return {
        hour,
        totalMs: data.totalMs,
        playCount: data.playCount,
      };
    });

    // Calculate streak
    const uniqueDays = new Set(dailyListening.map((day) => day.date));
    let streak = 0;
    for (let i = 0; ; i++) {
      const expectedDate = new Date();
      expectedDate.setHours(0, 0, 0, 0);
      expectedDate.setDate(expectedDate.getDate() - i);
      const expected = expectedDate.toISOString().split("T")[0];

      if (uniqueDays.has(expected)) {
        streak++;
      } else if (i === 0) {
        // If no plays today, check from yesterday
        continue;
      } else {
        break;
      }
    }

    const heatmapData = dailyListening.map((day) => ({
      date: day.date,
      count: day.playCount,
    }));

    return NextResponse.json({
      dailyListening,
      hourlyDistribution,
      streak,
      heatmapData,
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Trends API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
