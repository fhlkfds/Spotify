import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getStartOfToday,
  getStartOfWeek,
  getStartOfMonth,
} from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "week";

    // Determine date range
    let startDate: Date;
    switch (range) {
      case "today":
        startDate = getStartOfToday();
        break;
      case "week":
        startDate = getStartOfWeek();
        break;
      case "month":
        startDate = getStartOfMonth();
        break;
      default:
        startDate = new Date(0);
    }

    // Get plays within range
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: startDate },
      },
      include: {
        track: true,
        artist: true,
        album: true,
      },
      orderBy: { playedAt: "desc" },
    });

    // Calculate total listening time
    const totalMs = plays.reduce((sum, play) => sum + play.track.durationMs, 0);

    // Get unique counts
    const uniqueArtists = new Set(plays.map((p) => p.artistId)).size;
    const uniqueTracks = new Set(plays.map((p) => p.trackId)).size;
    const uniqueAlbums = new Set(plays.map((p) => p.albumId)).size;

    // Get top artists
    const artistPlays: Record<
      string,
      { artist: typeof plays[0]["artist"]; count: number; totalMs: number }
    > = {};
    for (const play of plays) {
      if (!artistPlays[play.artistId]) {
        artistPlays[play.artistId] = {
          artist: play.artist,
          count: 0,
          totalMs: 0,
        };
      }
      artistPlays[play.artistId].count++;
      artistPlays[play.artistId].totalMs += play.track.durationMs;
    }

    const topArtists = Object.values(artistPlays)
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 5)
      .map((a) => ({
        id: a.artist.id,
        name: a.artist.name,
        imageUrl: a.artist.imageUrl,
        playCount: a.count,
        totalMs: a.totalMs,
      }));

    // Get top tracks
    const trackPlays: Record<
      string,
      {
        track: typeof plays[0]["track"];
        artist: typeof plays[0]["artist"];
        album: typeof plays[0]["album"];
        count: number;
        totalMs: number;
      }
    > = {};
    for (const play of plays) {
      if (!trackPlays[play.trackId]) {
        trackPlays[play.trackId] = {
          track: play.track,
          artist: play.artist,
          album: play.album,
          count: 0,
          totalMs: 0,
        };
      }
      trackPlays[play.trackId].count++;
      trackPlays[play.trackId].totalMs += play.track.durationMs;
    }

    const topTracks = Object.values(trackPlays)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => ({
        id: t.track.id,
        name: t.track.name,
        artistName: t.artist.name,
        albumImageUrl: t.album.imageUrl,
        playCount: t.count,
        totalMs: t.totalMs,
      }));

    // Get recent plays (last 10)
    const recentPlays = plays.slice(0, 10).map((p) => ({
      id: p.id,
      trackName: p.track.name,
      artistName: p.artist.name,
      albumImageUrl: p.album.imageUrl,
      playedAt: p.playedAt,
      durationMs: p.track.durationMs,
    }));

    return NextResponse.json({
      stats: {
        totalMs,
        totalPlays: plays.length,
        uniqueArtists,
        uniqueTracks,
        uniqueAlbums,
      },
      topArtists,
      topTracks,
      recentPlays,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
