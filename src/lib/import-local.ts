import { prisma } from "./db";
import { parseImportFile } from "./import";
import type { NormalizedHistoryEntry, ImportResult } from "@/types";
import fs from "fs";
import path from "path";

// Minimum play duration to count (30 seconds in ms)
const MIN_PLAY_DURATION_MS = 30000;

/**
 * Import files from the local import folder without using Spotify API
 * Uses only data from the JSON files - no external API calls
 */
export async function importLocalFiles(userId: string): Promise<ImportResult> {
  const importDir = path.join(process.cwd(), 'import');

  // Check if import directory exists
  if (!fs.existsSync(importDir)) {
    throw new Error('Import directory not found. Please create an "import" folder in the project root.');
  }

  // Get all JSON files from the import directory
  const files = fs.readdirSync(importDir).filter((file) => file.endsWith('.json'));

  if (files.length === 0) {
    return {
      success: true,
      imported: 0,
      duplicates: 0,
      failed: 0,
      skipped: 0,
      errors: ['No JSON files found in the import folder'],
    };
  }

  console.log(`[Local Import] Found ${files.length} JSON file(s)`);

  let totalImported = 0;
  let totalDuplicates = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allErrors: string[] = [];

  // Track unique artists, albums, and tracks to create them without API
  const artistsMap = new Map<string, { id: string; name: string }>();
  const albumsMap = new Map<string, { id: string; name: string; artistId: string }>();
  const tracksMap = new Map<string, { id: string; name: string; albumId: string; artistId: string; duration: number }>();

  // Process each file
  for (const fileName of files) {
    try {
      const filePath = path.join(importDir, fileName);
      console.log(`[Local Import] Processing ${fileName}`);

      const content = fs.readFileSync(filePath, 'utf-8');
      const entries = parseImportFile(content);

      console.log(`[Local Import] Parsed ${entries.length} entries from ${fileName}`);

      if (entries.length === 0) {
        allErrors.push(`${fileName}: No valid entries found`);
        continue;
      }

      // Process entries
      for (const entry of entries) {
        try {
          // Skip entries without track ID (can't import without Spotify API)
          if (!entry.trackId) {
            totalSkipped++;
            continue;
          }

          // Generate IDs based on names (since we don't have real IDs)
          const artistId = entry.trackId.substring(0, 22); // Use part of track ID as artist ID
          const albumId = entry.trackId.substring(0, 20) + 'ab'; // Use part of track ID as album ID

          // Track artist info
          if (!artistsMap.has(artistId)) {
            artistsMap.set(artistId, {
              id: artistId,
              name: entry.artistName,
            });
          }

          // Track album info
          if (!albumsMap.has(albumId) && entry.albumName) {
            albumsMap.set(albumId, {
              id: albumId,
              name: entry.albumName,
              artistId: artistId,
            });
          }

          // Track track info
          if (!tracksMap.has(entry.trackId)) {
            tracksMap.set(entry.trackId, {
              id: entry.trackId,
              name: entry.trackName,
              albumId: albumId,
              artistId: artistId,
              duration: entry.msPlayed,
            });
          }

          // Create/update artist
          await prisma.artist.upsert({
            where: { id: artistId },
            update: { name: entry.artistName },
            create: {
              id: artistId,
              name: entry.artistName,
            },
          });

          // Create/update album if we have album name
          if (entry.albumName) {
            await prisma.album.upsert({
              where: { id: albumId },
              update: { name: entry.albumName },
              create: {
                id: albumId,
                name: entry.albumName,
                imageUrl: null,
                artistId: artistId,
              },
            });
          }

          // Create/update track
          await prisma.track.upsert({
            where: { id: entry.trackId },
            update: {
              name: entry.trackName,
              durationMs: entry.msPlayed,
            },
            create: {
              id: entry.trackId,
              name: entry.trackName,
              durationMs: entry.msPlayed,
              albumId: albumId,
              artistId: artistId,
            },
          });

          // Try to create play
          try {
            await prisma.play.create({
              data: {
                userId,
                trackId: entry.trackId,
                artistId: artistId,
                albumId: albumId,
                playedAt: entry.playedAt,
              },
            });
            totalImported++;
          } catch (error) {
            // Duplicate play
            totalDuplicates++;
          }
        } catch (error) {
          totalFailed++;
          const message = error instanceof Error ? error.message : "Unknown error";
          allErrors.push(`Failed to import ${entry.artistName} - ${entry.trackName}: ${message}`);
        }
      }

      console.log(`[Local Import] Completed ${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      allErrors.push(`Failed to process ${fileName}: ${message}`);
    }
  }

  console.log(`[Local Import] Complete: ${totalImported} imported, ${totalDuplicates} duplicates, ${totalFailed} failed, ${totalSkipped} skipped`);

  return {
    success: true,
    imported: totalImported,
    duplicates: totalDuplicates,
    failed: totalFailed,
    skipped: totalSkipped,
    errors: allErrors.slice(0, 100),
  };
}
