import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SpotifyClient } from "@/lib/spotify";

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

function analyzeMood(genres: string[]): { primary: string; secondary: string | null; score: number } {
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

  const sorted = Object.entries(moodScores).sort((a, b) => b[1] - a[1]);

  return {
    primary: sorted[0]?.[0] || "varied",
    secondary: sorted[1]?.[0] || null,
    score: sorted[0]?.[1] || 0,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's Spotify access token
    const account = await prisma.account.findFirst({
      where: { userId, provider: "spotify" },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "Spotify not connected" },
        { status: 400 }
      );
    }

    const spotify = new SpotifyClient(account.access_token);

    // Fetch user's playlists
    const playlistsResponse = await spotify.getUserPlaylists(50);
    const playlists = playlistsResponse.items;

    // Get user's play history for completion tracking
    const plays = await prisma.play.findMany({
      where: { userId },
      select: { trackId: true },
    });
    const playedTrackIds = new Set(plays.map((p) => p.trackId));

    // Get artist data for genre analysis
    const artistGenres: Record<string, string[]> = {};
    const artists = await prisma.artist.findMany({
      select: { id: true, genres: true },
    });
    for (const artist of artists) {
      if (artist.genres) {
        try {
          artistGenres[artist.id] = JSON.parse(artist.genres);
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Analyze each playlist
    const analyzedPlaylists = await Promise.all(
      playlists.slice(0, 20).map(async (playlist) => {
        try {
          // Fetch playlist tracks
          const tracksResponse = await spotify.getPlaylistTracks(playlist.id, 100);
          const tracks = tracksResponse.items.filter((item) => item.track !== null);

          if (tracks.length === 0) {
            return null;
          }

          // Calculate metrics
          const totalDurationMs = tracks.reduce(
            (sum, item) => sum + (item.track?.duration_ms || 0),
            0
          );

          // Count genres from artists
          const genreCounts: Record<string, number> = {};
          const artistCounts: Record<string, { name: string; count: number }> = {};
          const decadeCounts: Record<string, number> = {};
          let tracksPlayed = 0;

          for (const item of tracks) {
            if (!item.track) continue;

            // Check if track was played
            if (playedTrackIds.has(item.track.id)) {
              tracksPlayed++;
            }

            // Count artists
            for (const artist of item.track.artists) {
              if (!artistCounts[artist.id]) {
                artistCounts[artist.id] = { name: artist.name, count: 0 };
              }
              artistCounts[artist.id].count++;

              // Get genres for this artist
              const genres = artistGenres[artist.id] || [];
              for (const genre of genres) {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
              }
            }

            // Extract decade from album release date
            const album = item.track.album as { release_date?: string };
            if (album?.release_date) {
              const year = parseInt(album.release_date.substring(0, 4));
              if (!isNaN(year)) {
                const decade = `${Math.floor(year / 10) * 10}s`;
                decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
              }
            }
          }

          // Convert to arrays and sort
          const totalGenreCount = Object.values(genreCounts).reduce((a, b) => a + b, 0);
          const genres = Object.entries(genreCounts)
            .map(([genre, count]) => ({
              genre,
              count,
              percentage: totalGenreCount > 0 ? Math.round((count / totalGenreCount) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          const topArtists = Object.entries(artistCounts)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          const decades = Object.entries(decadeCounts)
            .map(([decade, count]) => ({ decade, count }))
            .sort((a, b) => b.count - a.count);

          // Analyze mood from genres
          const allGenres = Object.keys(genreCounts);
          const mood = analyzeMood(allGenres);

          return {
            id: playlist.id,
            name: playlist.name,
            imageUrl: playlist.images[0]?.url || null,
            description: playlist.description,
            totalTracks: tracks.length,
            totalDurationMs,
            owner: playlist.owner.display_name,
            genres,
            mood,
            artists: topArtists,
            decades,
            completionRate: tracks.length > 0 ? Math.round((tracksPlayed / tracks.length) * 100) : 0,
            tracksPlayed,
          };
        } catch (error) {
          console.error(`Error analyzing playlist ${playlist.id}:`, error);
          return null;
        }
      })
    );

    const validPlaylists = analyzedPlaylists.filter((p) => p !== null);

    // Sort by completion rate
    validPlaylists.sort((a, b) => b!.completionRate - a!.completionRate);

    return NextResponse.json({
      playlists: validPlaylists,
      totalPlaylists: playlistsResponse.total,
    });
  } catch (error) {
    console.error("Playlists API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
