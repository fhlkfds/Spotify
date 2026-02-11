import { prisma } from "./db";
import { SpotifyClient, refreshAccessToken } from "./spotify";
import type { SpotifyRecentlyPlayed } from "@/types";

export interface SyncResult {
  success: boolean;
  newPlays: number;
  error?: string;
}

/**
 * Sync a user's recently played tracks to the database
 */
export async function syncUserPlays(userId: string): Promise<SyncResult> {
  try {
    // Get user with tokens
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          where: { provider: "spotify" },
        },
      },
    });

    if (!user || user.accounts.length === 0) {
      return { success: false, newPlays: 0, error: "User not found" };
    }

    const account = user.accounts[0];
    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (account.expires_at && account.expires_at * 1000 < Date.now()) {
      if (!account.refresh_token) {
        return { success: false, newPlays: 0, error: "No refresh token" };
      }

      try {
        const refreshed = await refreshAccessToken(account.refresh_token);
        accessToken = refreshed.access_token;

        // Update tokens in database
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: refreshed.access_token,
            expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
            refresh_token: refreshed.refresh_token || account.refresh_token,
          },
        });
      } catch (error) {
        return { success: false, newPlays: 0, error: "Token refresh failed" };
      }
    }

    if (!accessToken) {
      return { success: false, newPlays: 0, error: "No access token" };
    }

    // Fetch recently played from Spotify
    const spotify = new SpotifyClient(accessToken);
    const recentlyPlayed = await spotify.getRecentlyPlayed(50);

    // Process and store plays
    const newPlays = await processRecentlyPlayed(userId, recentlyPlayed, spotify);

    return { success: true, newPlays };
  } catch (error) {
    console.error("Sync error:", error);
    return {
      success: false,
      newPlays: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch artist details and update artists with images and genres
 */
async function fetchAndUpdateArtistDetails(
  spotify: SpotifyClient,
  artistIds: string[]
): Promise<void> {
  // Process in batches of 50 (Spotify API limit)
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    try {
      const { artists } = await spotify.getArtists(batch);
      for (const artist of artists) {
        if (artist) {
          await prisma.artist.update({
            where: { id: artist.id },
            data: {
              imageUrl: artist.images?.[0]?.url || null,
              genres: artist.genres?.length ? JSON.stringify(artist.genres) : null,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error fetching artist details:", error);
    }
  }
}

/**
 * Process recently played tracks and store in database
 */
async function processRecentlyPlayed(
  userId: string,
  data: SpotifyRecentlyPlayed,
  spotify: SpotifyClient
): Promise<number> {
  let newPlaysCount = 0;
  const artistIds = new Set<string>();

  for (const item of data.items) {
    const { track, played_at } = item;
    const playedAt = new Date(played_at);
    const primaryArtist = track.artists[0];
    const album = track.album;

    // Collect artist IDs for batch fetching details
    artistIds.add(primaryArtist.id);

    // Upsert artist
    await prisma.artist.upsert({
      where: { id: primaryArtist.id },
      update: { name: primaryArtist.name },
      create: {
        id: primaryArtist.id,
        name: primaryArtist.name,
      },
    });

    // Upsert album
    await prisma.album.upsert({
      where: { id: album.id },
      update: {
        name: album.name,
        imageUrl: album.images[0]?.url,
      },
      create: {
        id: album.id,
        name: album.name,
        imageUrl: album.images[0]?.url,
        artistId: primaryArtist.id,
      },
    });

    // Upsert track
    await prisma.track.upsert({
      where: { id: track.id },
      update: {
        name: track.name,
        durationMs: track.duration_ms,
      },
      create: {
        id: track.id,
        name: track.name,
        durationMs: track.duration_ms,
        albumId: album.id,
        artistId: primaryArtist.id,
      },
    });

    // Idempotent insert: skip duplicates cleanly and keep accurate new-play count
    const existingPlay = await prisma.play.findUnique({
      where: {
        userId_trackId_playedAt: {
          userId,
          trackId: track.id,
          playedAt,
        },
      },
      select: { id: true },
    });

    if (!existingPlay) {
      try {
        await prisma.play.create({
          data: {
            userId,
            trackId: track.id,
            artistId: primaryArtist.id,
            albumId: album.id,
            playedAt,
          },
        });
        newPlaysCount++;
      } catch {
        // Another sync may have inserted the same play concurrently.
      }
    }
  }

  // Fetch and update artist details (images and genres)
  await fetchAndUpdateArtistDetails(spotify, Array.from(artistIds));

  return newPlaysCount;
}

/**
 * Update global statistics
 */
export async function updateGlobalStats(): Promise<void> {
  const totalUsers = await prisma.user.count();

  // Calculate average hours per week across all users
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weeklyPlays = await prisma.play.findMany({
    where: { playedAt: { gte: oneWeekAgo } },
    include: { track: true },
  });

  const totalMsThisWeek = weeklyPlays.reduce(
    (sum, play) => sum + play.track.durationMs,
    0
  );
  const avgHoursPerWeek =
    totalUsers > 0 ? totalMsThisWeek / (1000 * 60 * 60) / totalUsers : 0;

  // Get top genres from all artists
  const artists = await prisma.artist.findMany({
    where: { genres: { not: null } },
  });

  const genreCounts: Record<string, number> = {};
  for (const artist of artists) {
    if (artist.genres) {
      try {
        const genres = JSON.parse(artist.genres) as string[];
        for (const genre of genres) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre]) => genre);

  await prisma.globalStats.upsert({
    where: { id: "global" },
    update: {
      totalUsers,
      avgHoursPerWeek,
      topGenres: JSON.stringify(topGenres),
    },
    create: {
      id: "global",
      totalUsers,
      avgHoursPerWeek,
      topGenres: JSON.stringify(topGenres),
    },
  });
}
