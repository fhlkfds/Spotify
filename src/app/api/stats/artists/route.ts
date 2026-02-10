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
    const artistId = searchParams.get("artistId");

    if (artistId) {
      // Get detailed stats for a specific artist
      const plays = await prisma.play.findMany({
        where: { userId, artistId },
        include: { track: true, album: true },
        orderBy: { playedAt: "desc" },
      });

      const artist = await prisma.artist.findUnique({
        where: { id: artistId },
      });

      if (!artist) {
        return NextResponse.json({ error: "Artist not found" }, { status: 404 });
      }

      const totalMs = plays.reduce((sum, p) => sum + p.track.durationMs, 0);
      const firstPlay = plays[plays.length - 1]?.playedAt;

      // All tracks for this artist with first/last listen times
      const trackPlays: Record<string, {
        track: typeof plays[0]["track"];
        album: typeof plays[0]["album"];
        count: number;
        firstListen: Date;
        lastListen: Date;
        totalMs: number;
      }> = {};
      for (const play of plays) {
        if (!trackPlays[play.trackId]) {
          trackPlays[play.trackId] = {
            track: play.track,
            album: play.album,
            count: 0,
            firstListen: play.playedAt,
            lastListen: play.playedAt,
            totalMs: 0,
          };
        }
        trackPlays[play.trackId].count++;
        trackPlays[play.trackId].totalMs += play.track.durationMs;
        if (play.playedAt < trackPlays[play.trackId].firstListen) {
          trackPlays[play.trackId].firstListen = play.playedAt;
        }
        if (play.playedAt > trackPlays[play.trackId].lastListen) {
          trackPlays[play.trackId].lastListen = play.playedAt;
        }
      }

      const topTracks = Object.values(trackPlays)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((t) => ({
          id: t.track.id,
          name: t.track.name,
          playCount: t.count,
          durationMs: t.track.durationMs,
        }));

      // All tracks (not limited)
      const allTracks = Object.values(trackPlays)
        .sort((a, b) => b.count - a.count)
        .map((t) => ({
          id: t.track.id,
          name: t.track.name,
          albumName: t.album.name,
          albumImageUrl: t.album.imageUrl,
          playCount: t.count,
          durationMs: t.track.durationMs,
          totalMs: t.totalMs,
          firstListen: t.firstListen,
          lastListen: t.lastListen,
        }));

      // Top albums for this artist
      const albumPlays: Record<string, {
        album: typeof plays[0]["album"];
        count: number;
        totalMs: number;
        tracks: Set<string>;
      }> = {};
      for (const play of plays) {
        if (!albumPlays[play.albumId]) {
          albumPlays[play.albumId] = {
            album: play.album,
            count: 0,
            totalMs: 0,
            tracks: new Set(),
          };
        }
        albumPlays[play.albumId].count++;
        albumPlays[play.albumId].totalMs += play.track.durationMs;
        albumPlays[play.albumId].tracks.add(play.trackId);
      }

      const topAlbums = Object.values(albumPlays)
        .sort((a, b) => b.totalMs - a.totalMs)
        .map((a) => ({
          id: a.album.id,
          name: a.album.name,
          imageUrl: a.album.imageUrl,
          playCount: a.count,
          totalMs: a.totalMs,
          trackCount: a.tracks.size,
        }));

      // Listening over time
      const monthlyData: Record<string, number> = {};
      for (const play of plays) {
        const month = play.playedAt.toISOString().slice(0, 7);
        monthlyData[month] = (monthlyData[month] || 0) + play.track.durationMs;
      }

      const listeningOverTime = Object.entries(monthlyData)
        .map(([month, totalMs]) => ({ month, totalMs }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const lastPlay = plays[0]?.playedAt;

      return NextResponse.json({
        artist: {
          id: artist.id,
          name: artist.name,
          imageUrl: artist.imageUrl,
          genres: artist.genres ? JSON.parse(artist.genres) : [],
        },
        stats: {
          totalMs,
          playCount: plays.length,
          firstPlay,
          lastPlay,
        },
        topTracks,
        allTracks,
        topAlbums,
        listeningOverTime,
      });
    }

    // Get all artists with stats
    const plays = await prisma.play.findMany({
      where: { userId },
      include: { track: true, artist: true },
    });

    const artistData: Record<
      string,
      {
        artist: typeof plays[0]["artist"];
        totalMs: number;
        playCount: number;
        firstPlay: Date;
      }
    > = {};

    for (const play of plays) {
      if (!artistData[play.artistId]) {
        artistData[play.artistId] = {
          artist: play.artist,
          totalMs: 0,
          playCount: 0,
          firstPlay: play.playedAt,
        };
      }
      artistData[play.artistId].totalMs += play.track.durationMs;
      artistData[play.artistId].playCount++;
      if (play.playedAt < artistData[play.artistId].firstPlay) {
        artistData[play.artistId].firstPlay = play.playedAt;
      }
    }

    const artists = Object.values(artistData)
      .sort((a, b) => b.totalMs - a.totalMs)
      .map((a) => ({
        id: a.artist.id,
        name: a.artist.name,
        imageUrl: a.artist.imageUrl,
        totalMs: a.totalMs,
        playCount: a.playCount,
        firstPlay: a.firstPlay,
      }));

    return NextResponse.json({ artists });
  } catch (error) {
    console.error("Artists API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
