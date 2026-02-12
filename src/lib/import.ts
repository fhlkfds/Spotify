import { prisma } from "./db";
import { SpotifyClient } from "./spotify";
import type {
  StreamingHistoryEntry,
  ExtendedHistoryEntry,
  NormalizedHistoryEntry,
  ImportResult,
  SpotifyTrack,
} from "@/types";

// Minimum play duration to count (30 seconds in ms)
const MIN_PLAY_DURATION_MS = 30000;

// Batch size for processing
const BATCH_SIZE = 100;

// Delay between batches to avoid rate limiting (ms)
const BATCH_DELAY_MS = 100;

// Maximum concurrent API requests to avoid rate limiting
const MAX_CONCURRENT_REQUESTS = 10;

// In-memory cache for track lookups
const trackCache = new Map<string, SpotifyTrack | null>();

/**
 * Generate cache key for track lookup
 */
function getCacheKey(artistName: string, trackName: string): string {
  return `${artistName.toLowerCase()}:${trackName.toLowerCase()}`;
}

/**
 * Detect format and parse import file
 */
export function parseImportFile(content: string): NormalizedHistoryEntry[] {
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error("Invalid file format: expected an array");
  }

  if (data.length === 0) {
    return [];
  }

  // Detect format by checking for characteristic fields
  const firstEntry = data[0];

  if ("endTime" in firstEntry) {
    // StreamingHistory format
    return parseStreamingHistory(data as StreamingHistoryEntry[]);
  } else if ("ts" in firstEntry) {
    // Extended history format
    return parseExtendedHistory(data as ExtendedHistoryEntry[]);
  } else {
    throw new Error(
      "Unknown file format: expected StreamingHistory or Extended History format"
    );
  }
}

/**
 * Parse StreamingHistory format (Account Data export)
 */
function parseStreamingHistory(
  entries: StreamingHistoryEntry[]
): NormalizedHistoryEntry[] {
  return entries
    .filter((entry) => entry.msPlayed >= MIN_PLAY_DURATION_MS)
    .map((entry) => ({
      // endTime format: "2024-01-15 14:30"
      playedAt: new Date(entry.endTime.replace(" ", "T") + ":00Z"),
      artistName: entry.artistName,
      trackName: entry.trackName,
      albumName: null,
      trackId: null,
      msPlayed: entry.msPlayed,
    }));
}

/**
 * Parse Extended History format
 */
function parseExtendedHistory(
  entries: ExtendedHistoryEntry[]
): NormalizedHistoryEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.ms_played >= MIN_PLAY_DURATION_MS &&
        entry.master_metadata_track_name &&
        entry.master_metadata_album_artist_name
    )
    .map((entry) => ({
      playedAt: new Date(entry.ts),
      artistName: entry.master_metadata_album_artist_name!,
      trackName: entry.master_metadata_track_name!,
      albumName: entry.master_metadata_album_album_name,
      trackId: entry.spotify_track_uri
        ? entry.spotify_track_uri.replace("spotify:track:", "")
        : null,
      msPlayed: entry.ms_played,
    }));
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process items in batches with limited concurrency
 */
async function processConcurrently<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));
    results.push(...batchResults);

    // Small delay between concurrent batches
    if (i + concurrency < items.length) {
      await sleep(100);
    }
  }

  return results;
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('rate limit');

      if (isLastAttempt || !isRateLimitError) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Look up track info from Spotify API with caching and retry logic
 */
async function lookupTrack(
  spotify: SpotifyClient,
  entry: NormalizedHistoryEntry
): Promise<SpotifyTrack | null> {
  // If we have a track ID from extended history, fetch directly
  if (entry.trackId) {
    const cacheKey = entry.trackId;
    if (trackCache.has(cacheKey)) {
      return trackCache.get(cacheKey)!;
    }

    try {
      const track = await retryWithBackoff(() => spotify.getTrack(entry.trackId!));
      trackCache.set(cacheKey, track);
      return track;
    } catch (error) {
      // Track might have been removed from Spotify or API error
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Failed to fetch track ${entry.trackId}:`, errorMsg);
      trackCache.set(cacheKey, null);
      return null;
    }
  }

  // Otherwise, search by artist and track name
  const cacheKey = getCacheKey(entry.artistName, entry.trackName);
  if (trackCache.has(cacheKey)) {
    return trackCache.get(cacheKey)!;
  }

  try {
    const track = await retryWithBackoff(() =>
      spotify.searchTrack(entry.trackName, entry.artistName)
    );
    trackCache.set(cacheKey, track);
    return track;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to search track "${entry.trackName}" by "${entry.artistName}":`, errorMsg);
    // Return a more descriptive error by throwing with context
    throw new Error(`Spotify API error: ${errorMsg}`);
  }
}

/**
 * Import a batch of history entries (with parallel track lookups)
 */
async function importBatch(
  userId: string,
  spotify: SpotifyClient,
  entries: NormalizedHistoryEntry[],
  onProgress?: (imported: number, duplicates: number, failed: number) => void
): Promise<{ imported: number; duplicates: number; failed: number; errors: string[] }> {
  let imported = 0;
  let duplicates = 0;
  let failed = 0;
  const errors: string[] = [];

  // Look up tracks with limited concurrency to avoid rate limiting
  const trackLookups = await processConcurrently(
    entries,
    async (entry) => {
      const track = await lookupTrack(spotify, entry);
      return { entry, track };
    },
    MAX_CONCURRENT_REQUESTS
  );

  // Process each result
  for (const result of trackLookups) {
    if (result.status === 'rejected') {
      failed++;
      const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${errorMsg}`);
      continue;
    }

    const { entry, track } = result.value;

    try {
      if (!track) {
        failed++;
        errors.push(`Track not found on Spotify: ${entry.artistName} - ${entry.trackName}`);
        continue;
      }

      const primaryArtist = track.artists[0];
      const album = track.album;

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

      // Try to create play (will fail if duplicate due to unique constraint)
      try {
        await prisma.play.create({
          data: {
            userId,
            trackId: track.id,
            artistId: primaryArtist.id,
            albumId: album.id,
            playedAt: entry.playedAt,
          },
        });
        imported++;
      } catch {
        // Duplicate play
        duplicates++;
      }

      onProgress?.(imported, duplicates, failed);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to import ${entry.artistName} - ${entry.trackName}: ${message}`);
    }
  }

  return { imported, duplicates, failed, errors };
}

/**
 * Main import function - processes entries in batches
 */
export async function importHistory(
  userId: string,
  accessToken: string,
  entries: NormalizedHistoryEntry[],
  onProgress?: (progress: {
    processed: number;
    total: number;
    imported: number;
    duplicates: number;
    failed: number;
  }) => void
): Promise<ImportResult> {
  const spotify = new SpotifyClient(accessToken);
  const totalEntries = entries.length;

  let totalImported = 0;
  let totalDuplicates = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  // Process in batches
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    const result = await importBatch(userId, spotify, batch, (imp, dup, fail) => {
      onProgress?.({
        processed: i + imp + dup + fail,
        total: totalEntries,
        imported: totalImported + imp,
        duplicates: totalDuplicates + dup,
        failed: totalFailed + fail,
      });
    });

    totalImported += result.imported;
    totalDuplicates += result.duplicates;
    totalFailed += result.failed;
    allErrors.push(...result.errors);

    // Rate limit delay between batches
    if (i + BATCH_SIZE < entries.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return {
    success: true,
    imported: totalImported,
    duplicates: totalDuplicates,
    failed: totalFailed,
    skipped: 0, // Already filtered out during parsing
    errors: allErrors.slice(0, 50), // Limit error messages
  };
}

/**
 * Clear the track cache (useful between import sessions)
 */
export function clearTrackCache(): void {
  trackCache.clear();
}

/**
 * Get access token for a user
 */
export async function getUserAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "spotify",
    },
  });

  if (!account?.access_token) {
    return null;
  }

  // Check if token is expired
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    if (!account.refresh_token) {
      return null;
    }

    // Import dynamically to avoid circular dependency
    const { refreshAccessToken } = await import("./spotify");

    try {
      const refreshed = await refreshAccessToken(account.refresh_token);

      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: refreshed.access_token,
          expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
          refresh_token: refreshed.refresh_token || account.refresh_token,
        },
      });

      return refreshed.access_token;
    } catch {
      return null;
    }
  }

  return account.access_token;
}
