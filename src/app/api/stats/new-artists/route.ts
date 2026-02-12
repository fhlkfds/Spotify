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

    // Find all artists the user has ever listened to before this period
    const artistsBeforePeriod = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { lt: startDate },
      },
      select: {
        artistId: true,
      },
      distinct: ["artistId"],
    });

    const existingArtistIds = new Set(artistsBeforePeriod.map((p) => p.artistId));

    // Get all plays from this period
    const playsThisPeriod = await prisma.play.findMany({
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

    // Group plays by artist and filter to only new artists
    const newArtistPlays: Record<
      string,
      {
        artist: typeof playsThisPeriod[0]["artist"];
        count: number;
        totalMs: number;
        firstPlayedAt: Date;
      }
    > = {};

    for (const play of playsThisPeriod) {
      // Skip if user listened to this artist before this month
      if (existingArtistIds.has(play.artistId)) {
        continue;
      }

      if (!newArtistPlays[play.artistId]) {
        newArtistPlays[play.artistId] = {
          artist: play.artist,
          count: 0,
          totalMs: 0,
          firstPlayedAt: play.playedAt,
        };
      }
      newArtistPlays[play.artistId].count++;
      newArtistPlays[play.artistId].totalMs += play.track.durationMs;
    }

    // Sort by listening time and take top 5
    const newArtists = Object.values(newArtistPlays)
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 5)
      .map((a) => ({
        id: a.artist.id,
        name: a.artist.name,
        imageUrl: a.artist.imageUrl,
        playCount: a.count,
        totalMs: a.totalMs,
        firstPlayedAt: a.firstPlayedAt.toISOString(),
      }));

    return NextResponse.json({ newArtists });
  } catch (error) {
    console.error("New artists API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
