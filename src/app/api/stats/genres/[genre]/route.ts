import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { genre: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const genre = decodeURIComponent(params.genre).toLowerCase();

    // Get all plays with artist data
    const plays = await prisma.play.findMany({
      where: { userId },
      include: {
        track: true,
        artist: true,
        album: true,
      },
    });

    // Filter plays by genre
    const genrePlays = plays.filter((play) => {
      if (!play.artist.genres) return false;
      try {
        const genres = JSON.parse(play.artist.genres) as string[];
        return genres.some((g) => g.toLowerCase() === genre);
      } catch {
        return false;
      }
    });

    if (genrePlays.length === 0) {
      return NextResponse.json({
        genre,
        artists: [],
        tracks: [],
        stats: {
          totalPlays: 0,
          totalMs: 0,
          uniqueArtists: 0,
          uniqueTracks: 0,
        },
      });
    }

    // Build artist statistics
    const artistData: Record<
      string,
      {
        artist: typeof genrePlays[0]["artist"];
        playCount: number;
        totalMs: number;
      }
    > = {};

    for (const play of genrePlays) {
      if (!artistData[play.artistId]) {
        artistData[play.artistId] = {
          artist: play.artist,
          playCount: 0,
          totalMs: 0,
        };
      }
      artistData[play.artistId].playCount++;
      artistData[play.artistId].totalMs += play.track.durationMs;
    }

    const artists = Object.values(artistData)
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 20)
      .map((a) => ({
        id: a.artist.id,
        name: a.artist.name,
        imageUrl: a.artist.imageUrl,
        playCount: a.playCount,
        totalMs: a.totalMs,
      }));

    // Build track statistics
    const trackData: Record<
      string,
      {
        track: typeof genrePlays[0]["track"];
        artist: typeof genrePlays[0]["artist"];
        album: typeof genrePlays[0]["album"];
        playCount: number;
        totalMs: number;
      }
    > = {};

    for (const play of genrePlays) {
      if (!trackData[play.trackId]) {
        trackData[play.trackId] = {
          track: play.track,
          artist: play.artist,
          album: play.album,
          playCount: 0,
          totalMs: 0,
        };
      }
      trackData[play.trackId].playCount++;
      trackData[play.trackId].totalMs += play.track.durationMs;
    }

    const tracks = Object.values(trackData)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 20)
      .map((t) => ({
        id: t.track.id,
        name: t.track.name,
        artistName: t.artist.name,
        albumName: t.album.name,
        albumImageUrl: t.album.imageUrl,
        playCount: t.playCount,
        totalMs: t.totalMs,
      }));

    // Calculate stats
    const totalMs = genrePlays.reduce((sum, p) => sum + p.track.durationMs, 0);
    const uniqueArtists = new Set(genrePlays.map((p) => p.artistId)).size;
    const uniqueTracks = new Set(genrePlays.map((p) => p.trackId)).size;

    return NextResponse.json({
      genre,
      artists,
      tracks,
      stats: {
        totalPlays: genrePlays.length,
        totalMs,
        uniqueArtists,
        uniqueTracks,
      },
    });
  } catch (error) {
    console.error("Genre detail API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
