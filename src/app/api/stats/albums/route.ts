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

    // Get all plays with album info
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: startDate, lte: endDate },
      },
      include: {
        track: true,
        album: { include: { artist: true } }
      },
    });

    // Group by album
    const albumData: Record<
      string,
      {
        album: typeof plays[0]["album"];
        totalMs: number;
        playCount: number;
        tracksPlayed: Set<string>;
        firstPlay: Date;
      }
    > = {};

    for (const play of plays) {
      if (!albumData[play.albumId]) {
        albumData[play.albumId] = {
          album: play.album,
          totalMs: 0,
          playCount: 0,
          tracksPlayed: new Set(),
          firstPlay: play.playedAt,
        };
      }
      albumData[play.albumId].totalMs += play.track.durationMs;
      albumData[play.albumId].playCount++;
      albumData[play.albumId].tracksPlayed.add(play.trackId);
      if (play.playedAt < albumData[play.albumId].firstPlay) {
        albumData[play.albumId].firstPlay = play.playedAt;
      }
    }

    // Get track counts per album
    const albumTrackCounts = await prisma.track.groupBy({
      by: ["albumId"],
      _count: { id: true },
    });

    const trackCountMap = new Map(
      albumTrackCounts.map((a) => [a.albumId, a._count.id])
    );

    const albums = Object.values(albumData)
      .sort((a, b) => b.totalMs - a.totalMs)
      .map((a) => ({
        id: a.album.id,
        name: a.album.name,
        artistName: a.album.artist.name,
        imageUrl: a.album.imageUrl,
        totalMs: a.totalMs,
        playCount: a.playCount,
        tracksPlayed: a.tracksPlayed.size,
        totalTracks: trackCountMap.get(a.album.id) || a.tracksPlayed.size,
        firstPlay: a.firstPlay,
        completionRate: Math.round(
          (a.tracksPlayed.size / (trackCountMap.get(a.album.id) || a.tracksPlayed.size)) * 100
        ),
      }));

    return NextResponse.json({ albums });
  } catch (error) {
    console.error("Albums API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
