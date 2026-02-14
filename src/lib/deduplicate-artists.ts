import { prisma } from "./db";

interface DeduplicationResult {
  success: boolean;
  artistsMerged: number;
  albumsMerged: number;
  errors: string[];
}

/**
 * Deduplicate artists and albums by name
 * Merges duplicate entries and updates all references
 */
export async function deduplicateArtistsAndAlbums(): Promise<DeduplicationResult> {
  let artistsMerged = 0;
  let albumsMerged = 0;
  const errors: string[] = [];

  try {
    console.log("[Deduplicate] Starting deduplication...");

    // Find duplicate artists (same name, different IDs)
    const allArtists = await prisma.artist.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        genres: true,
      },
    });

    // Group artists by normalized name
    const artistsByName = new Map<string, typeof allArtists>();
    for (const artist of allArtists) {
      const normalizedName = artist.name.toLowerCase().trim();
      const existing = artistsByName.get(normalizedName) || [];
      existing.push(artist);
      artistsByName.set(normalizedName, existing);
    }

    // Merge duplicate artists
    for (const [name, artists] of Array.from(artistsByName.entries())) {
      if (artists.length <= 1) continue;

      console.log(`[Deduplicate] Found ${artists.length} duplicates for "${artists[0].name}"`);

      // Keep the one with an image, or the first one
      const primary = artists.find((artist) => artist.imageUrl) || artists[0];
      const duplicates = artists.filter((artist) => artist.id !== primary.id);

      for (const duplicate of duplicates) {
        try {
          // Update all plays to point to primary artist
          await prisma.play.updateMany({
            where: { artistId: duplicate.id },
            data: { artistId: primary.id },
          });

          // Update all tracks to point to primary artist
          await prisma.track.updateMany({
            where: { artistId: duplicate.id },
            data: { artistId: primary.id },
          });

          // Update all albums to point to primary artist
          await prisma.album.updateMany({
            where: { artistId: duplicate.id },
            data: { artistId: primary.id },
          });

          // Delete the duplicate artist
          await prisma.artist.delete({
            where: { id: duplicate.id },
          });

          artistsMerged++;
          console.log(`[Deduplicate] Merged duplicate artist: ${duplicate.name} (${duplicate.id})`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          errors.push(`Failed to merge artist ${duplicate.name}: ${message}`);
        }
      }
    }

    // Find duplicate albums (same name + artist, different IDs)
    const allAlbums = await prisma.album.findMany({
      select: {
        id: true,
        name: true,
        artistId: true,
        imageUrl: true,
      },
    });

    // Group albums by normalized name + artistId
    const albumsByKey = new Map<string, typeof allAlbums>();
    for (const album of allAlbums) {
      const key = `${album.artistId}:${album.name.toLowerCase().trim()}`;
      const existing = albumsByKey.get(key) || [];
      existing.push(album);
      albumsByKey.set(key, existing);
    }

    // Merge duplicate albums
    for (const [key, albums] of Array.from(albumsByKey.entries())) {
      if (albums.length <= 1) continue;

      console.log(`[Deduplicate] Found ${albums.length} duplicates for album "${albums[0].name}"`);

      // Keep the one with an image, or the first one
      const primary = albums.find((album) => album.imageUrl) || albums[0];
      const duplicates = albums.filter((album) => album.id !== primary.id);

      for (const duplicate of duplicates) {
        try {
          // Update all plays to point to primary album
          await prisma.play.updateMany({
            where: { albumId: duplicate.id },
            data: { albumId: primary.id },
          });

          // Update all tracks to point to primary album
          await prisma.track.updateMany({
            where: { albumId: duplicate.id },
            data: { albumId: primary.id },
          });

          // Delete the duplicate album
          await prisma.album.delete({
            where: { id: duplicate.id },
          });

          albumsMerged++;
          console.log(`[Deduplicate] Merged duplicate album: ${duplicate.name} (${duplicate.id})`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          errors.push(`Failed to merge album ${duplicate.name}: ${message}`);
        }
      }
    }

    console.log(`[Deduplicate] Complete: ${artistsMerged} artists merged, ${albumsMerged} albums merged`);

    return {
      success: true,
      artistsMerged,
      albumsMerged,
      errors: errors.slice(0, 50),
    };
  } catch (error) {
    console.error("[Deduplicate] Error:", error);
    return {
      success: false,
      artistsMerged,
      albumsMerged,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Get count of duplicate artists and albums
 */
export async function getDuplicatesCount(): Promise<{
  duplicateArtists: number;
  duplicateAlbums: number;
}> {
  const allArtists = await prisma.artist.findMany({
    select: { name: true },
  });

  const allAlbums = await prisma.album.findMany({
    select: { name: true, artistId: true },
  });

  // Count duplicate artists
  const artistNames = new Map<string, number>();
  for (const artist of allArtists) {
    const normalized = artist.name.toLowerCase().trim();
    artistNames.set(normalized, (artistNames.get(normalized) || 0) + 1);
  }
  const duplicateArtists = Array.from(artistNames.values()).filter((count) => count > 1).length;

  // Count duplicate albums
  const albumKeys = new Map<string, number>();
  for (const album of allAlbums) {
    const key = `${album.artistId}:${album.name.toLowerCase().trim()}`;
    albumKeys.set(key, (albumKeys.get(key) || 0) + 1);
  }
  const duplicateAlbums = Array.from(albumKeys.values()).filter((count) => count > 1).length;

  return { duplicateArtists, duplicateAlbums };
}
