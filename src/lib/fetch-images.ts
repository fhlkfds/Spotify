import { prisma } from "./db";
import { SpotifyClient } from "./spotify";

interface FetchImagesResult {
  success: boolean;
  artistsUpdated: number;
  albumsUpdated: number;
  failed: number;
  errors: string[];
}

/**
 * Fetch missing images for artists, albums, and tracks from Spotify API
 * This is useful after a local import which doesn't fetch images
 */
export async function fetchMissingImages(
  accessToken: string,
  limit: number = 50
): Promise<FetchImagesResult> {
  const spotify = new SpotifyClient(accessToken);
  let artistsUpdated = 0;
  let albumsUpdated = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Find artists without images
    const artistsWithoutImages = await prisma.artist.findMany({
      where: {
        OR: [
          { imageUrl: null },
          { imageUrl: "" },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`[Fetch Images] Found ${artistsWithoutImages.length} artists without images`);

    // Fetch artist details from Spotify in batches
    for (const artist of artistsWithoutImages) {
      try {
        // Use the track ID to get full track details which includes artist info
        // First, find a track by this artist
        const track = await prisma.track.findFirst({
          where: { artistId: artist.id },
          select: { id: true },
        });

        if (!track) {
          console.log(`[Fetch Images] No tracks found for artist ${artist.name}`);
          continue;
        }

        // Fetch track details from Spotify
        const trackDetails = await spotify.getTrack(track.id);

        if (trackDetails && trackDetails.artists && trackDetails.artists[0]) {
          const spotifyArtist = trackDetails.artists[0];

          // Fetch full artist details to get images
          const response = await fetch(
            `https://api.spotify.com/v1/artists/${spotifyArtist.id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (response.ok) {
            const artistData = await response.json();
            const imageUrl = artistData.images?.[0]?.url || null;

            // Update artist with image
            await prisma.artist.update({
              where: { id: artist.id },
              data: {
                imageUrl,
                spotifyId: artistData.id,
              },
            });

            artistsUpdated++;
            console.log(`[Fetch Images] Updated artist: ${artist.name}`);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to fetch image for artist ${artist.name}: ${message}`);
      }
    }

    // Find albums without images
    const albumsWithoutImages = await prisma.album.findMany({
      where: {
        OR: [
          { imageUrl: null },
          { imageUrl: "" },
        ],
      },
      take: limit,
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`[Fetch Images] Found ${albumsWithoutImages.length} albums without images`);

    // Fetch album details from Spotify
    for (const album of albumsWithoutImages) {
      try {
        const response = await fetch(
          `https://api.spotify.com/v1/albums/${album.id}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.ok) {
          const albumData = await response.json();
          const imageUrl = albumData.images?.[0]?.url || null;

          // Update album with image
          await prisma.album.update({
            where: { id: album.id },
            data: { imageUrl },
          });

          albumsUpdated++;
          console.log(`[Fetch Images] Updated album: ${album.name}`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to fetch image for album ${album.name}: ${message}`);
      }
    }

    return {
      success: true,
      artistsUpdated,
      albumsUpdated,
      failed,
      errors: errors.slice(0, 50),
    };
  } catch (error) {
    console.error("[Fetch Images] Error:", error);
    return {
      success: false,
      artistsUpdated,
      albumsUpdated,
      failed,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Get count of items missing images
 */
export async function getMissingImagesCount(): Promise<{
  artists: number;
  albums: number;
}> {
  const [artists, albums] = await Promise.all([
    prisma.artist.count({
      where: {
        OR: [
          { imageUrl: null },
          { imageUrl: "" },
        ],
      },
    }),
    prisma.album.count({
      where: {
        OR: [
          { imageUrl: null },
          { imageUrl: "" },
        ],
      },
    }),
  ]);

  return { artists, albums };
}
