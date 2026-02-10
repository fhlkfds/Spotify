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
    const trackId = searchParams.get("trackId");

    if (!trackId) {
      return NextResponse.json({ error: "Track ID required" }, { status: 400 });
    }

    // Get track details
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: {
        artist: true,
        album: true,
      },
    });

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Get all plays for this track by this user
    const plays = await prisma.play.findMany({
      where: { userId, trackId },
      orderBy: { playedAt: "desc" },
    });

    if (plays.length === 0) {
      return NextResponse.json({ error: "No plays found for this track" }, { status: 404 });
    }

    const totalMs = plays.length * track.durationMs;
    const firstPlay = plays[plays.length - 1].playedAt;
    const lastPlay = plays[0].playedAt;

    // Listening over time (monthly)
    const monthlyData: Record<string, number> = {};
    for (const play of plays) {
      const month = play.playedAt.toISOString().slice(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + track.durationMs;
    }

    const listeningOverTime = Object.entries(monthlyData)
      .map(([month, totalMs]) => ({ month, totalMs }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Get recent plays (last 10)
    const recentPlays = plays.slice(0, 10).map((p) => ({
      id: p.id,
      playedAt: p.playedAt,
    }));

    return NextResponse.json({
      track: {
        id: track.id,
        name: track.name,
        durationMs: track.durationMs,
        artist: {
          id: track.artist.id,
          name: track.artist.name,
          imageUrl: track.artist.imageUrl,
        },
        album: {
          id: track.album.id,
          name: track.album.name,
          imageUrl: track.album.imageUrl,
        },
      },
      stats: {
        totalMs,
        playCount: plays.length,
        firstPlay,
        lastPlay,
      },
      listeningOverTime,
      recentPlays,
    });
  } catch (error) {
    console.error("Track stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
