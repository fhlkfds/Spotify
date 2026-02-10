import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SpotifyClient, refreshAccessToken } from "@/lib/spotify";

// Mood keywords for genre analysis
const MOOD_KEYWORDS: Record<string, string[]> = {
  energetic: ["workout", "gym", "power", "metal", "hardcore", "punk", "edm", "drum and bass", "dubstep", "dance", "electronic"],
  chill: ["chill", "ambient", "lofi", "lo-fi", "relax", "sleep", "meditation", "acoustic", "soft", "calm"],
  happy: ["happy", "feel-good", "party", "upbeat", "fun", "pop", "disco", "funk"],
  sad: ["sad", "melancholy", "heartbreak", "emo", "blues", "ballad", "grief"],
  romantic: ["love", "romance", "romantic", "soul", "r&b", "smooth"],
  focus: ["study", "focus", "classical", "instrumental", "piano", "minimal", "ambient"],
  angry: ["angry", "rage", "aggressive", "death metal", "black metal", "grindcore", "thrash"],
};

function getMoodScores(genres: string[]): Record<string, number> {
  const moodScores: Record<string, number> = {};

  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerGenre.includes(keyword)) {
          moodScores[mood] = (moodScores[mood] || 0) + 1;
        }
      }
    }
  }

  return moodScores;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: playlistId } = await params;
    const userId = session.user.id;

    // Get user's Spotify access token
    const account = await prisma.account.findFirst({
      where: { userId, provider: "spotify" },
    });

    if (!account?.access_token || !account?.refresh_token) {
      return NextResponse.json(
        { error: "Spotify not connected" },
        { status: 400 }
      );
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (account.expires_at && Date.now() >= account.expires_at * 1000) {
      try {
        const refreshed = await refreshAccessToken(account.refresh_token);
        accessToken = refreshed.access_token;

        // Update stored tokens
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: refreshed.access_token,
            expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
            refresh_token: refreshed.refresh_token || account.refresh_token,
          },
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to refresh Spotify token" },
          { status: 401 }
        );
      }
    }

    const spotify = new SpotifyClient(accessToken);

    // Fetch playlist details
    const playlist = await spotify.getPlaylist(playlistId);

    // Fetch all tracks (paginated if necessary)
    let allTracks: { added_at: string; track: { id: string; name: string; duration_ms: number; artists: { id: string; name: string }[]; album: { id: string; name: string; images: { url: string }[]; release_date?: string } } | null }[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const tracksResponse = await spotify.getPlaylistTracks(playlistId, limit, offset);
      allTracks = allTracks.concat(tracksResponse.items);
      if (allTracks.length >= tracksResponse.total || tracksResponse.items.length < limit) {
        break;
      }
      offset += limit;
    }

    const tracks = allTracks.filter((item) => item.track !== null);

    // Get user's play history for this playlist's tracks
    const trackIds = tracks.map((t) => t.track!.id);
    const plays = await prisma.play.findMany({
      where: {
        userId,
        trackId: { in: trackIds },
      },
      include: { track: true },
    });

    const playCountByTrack: Record<string, number> = {};
    const totalMsByTrack: Record<string, number> = {};
    for (const play of plays) {
      playCountByTrack[play.trackId] = (playCountByTrack[play.trackId] || 0) + 1;
      totalMsByTrack[play.trackId] = (totalMsByTrack[play.trackId] || 0) + play.track.durationMs;
    }

    // Get artist genres
    const artistIds = Array.from(new Set(tracks.flatMap((t) => t.track!.artists.map((a) => a.id))));
    const artists = await prisma.artist.findMany({
      where: { id: { in: artistIds } },
      select: { id: true, genres: true, imageUrl: true },
    });

    const artistGenres: Record<string, string[]> = {};
    const artistImages: Record<string, string | null> = {};
    for (const artist of artists) {
      artistImages[artist.id] = artist.imageUrl;
      if (artist.genres) {
        try {
          artistGenres[artist.id] = JSON.parse(artist.genres);
        } catch {
          artistGenres[artist.id] = [];
        }
      }
    }

    // Analyze tracks
    const trackAnalysis = tracks.map((item) => {
      const track = item.track!;
      const trackGenres: string[] = [];
      for (const artist of track.artists) {
        trackGenres.push(...(artistGenres[artist.id] || []));
      }
      const moodScores = getMoodScores(trackGenres);
      const topMood = Object.entries(moodScores).sort((a, b) => b[1] - a[1])[0];

      return {
        id: track.id,
        name: track.name,
        artistName: track.artists.map((a) => a.name).join(", "),
        artistIds: track.artists.map((a) => a.id),
        albumName: track.album.name,
        albumImageUrl: track.album.images[0]?.url || null,
        durationMs: track.duration_ms,
        addedAt: item.added_at,
        playCount: playCountByTrack[track.id] || 0,
        totalListenedMs: totalMsByTrack[track.id] || 0,
        genres: trackGenres.slice(0, 5),
        mood: topMood ? topMood[0] : "varied",
        releaseYear: track.album.release_date ? parseInt(track.album.release_date.substring(0, 4)) : null,
      };
    });

    // Calculate overall stats
    const totalDurationMs = tracks.reduce((sum, t) => sum + (t.track?.duration_ms || 0), 0);
    const tracksPlayed = trackAnalysis.filter((t) => t.playCount > 0).length;
    const completionRate = tracks.length > 0 ? Math.round((tracksPlayed / tracks.length) * 100) : 0;
    const totalListenedMs = Object.values(totalMsByTrack).reduce((a, b) => a + b, 0);
    const listenedPercentage = totalDurationMs > 0 ? Math.round((totalListenedMs / totalDurationMs) * 100) : 0;

    // Genre distribution
    const genreCounts: Record<string, number> = {};
    for (const track of trackAnalysis) {
      for (const genre of track.genres) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }
    const totalGenreCount = Object.values(genreCounts).reduce((a, b) => a + b, 0);
    const topGenres = Object.entries(genreCounts)
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: totalGenreCount > 0 ? Math.round((count / totalGenreCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Artist distribution
    const artistCounts: Record<string, { name: string; imageUrl: string | null; count: number }> = {};
    for (const track of trackAnalysis) {
      for (let i = 0; i < track.artistIds.length; i++) {
        const artistId = track.artistIds[i];
        const artistName = track.artistName.split(", ")[i] || track.artistName;
        if (!artistCounts[artistId]) {
          artistCounts[artistId] = { name: artistName, imageUrl: artistImages[artistId] || null, count: 0 };
        }
        artistCounts[artistId].count++;
      }
    }
    const topArtists = Object.entries(artistCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Mood distribution
    const moodCounts: Record<string, number> = {};
    for (const track of trackAnalysis) {
      moodCounts[track.mood] = (moodCounts[track.mood] || 0) + 1;
    }
    const moodDistribution = Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        count,
        percentage: Math.round((count / tracks.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Decade distribution
    const decadeCounts: Record<string, number> = {};
    for (const track of trackAnalysis) {
      if (track.releaseYear) {
        const decade = `${Math.floor(track.releaseYear / 10) * 10}s`;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
      }
    }
    const decadeDistribution = Object.entries(decadeCounts)
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade.localeCompare(b.decade));

    // Most played tracks from this playlist
    const mostPlayed = [...trackAnalysis]
      .filter((t) => t.playCount > 0)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    // Unplayed tracks
    const unplayed = trackAnalysis.filter((t) => t.playCount === 0).slice(0, 10);

    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        imageUrl: playlist.images[0]?.url || null,
        owner: playlist.owner.display_name,
        totalTracks: tracks.length,
        totalDurationMs,
        isPublic: playlist.public,
        isCollaborative: playlist.collaborative,
      },
      stats: {
        tracksPlayed,
        completionRate,
        totalListenedMs,
        listenedPercentage,
        avgPlaysPerTrack: tracksPlayed > 0 ? Math.round(plays.length / tracksPlayed * 10) / 10 : 0,
      },
      topGenres,
      topArtists,
      moodDistribution,
      decadeDistribution,
      mostPlayed,
      unplayed,
      tracks: trackAnalysis,
    });
  } catch (error) {
    console.error("Playlist detail API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
