import type { SpotifyRecentlyPlayed, SpotifyArtist, SpotifyTrack } from "@/types";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export class SpotifyClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Spotify API error: ${response.status} ${error.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get recently played tracks
   * @param limit Number of items to return (max 50)
   * @param after Unix timestamp in ms - return items after this
   */
  async getRecentlyPlayed(
    limit: number = 50,
    after?: number
  ): Promise<SpotifyRecentlyPlayed> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (after) {
      params.set("after", String(after));
    }
    return this.fetch<SpotifyRecentlyPlayed>(
      `/me/player/recently-played?${params}`
    );
  }

  /**
   * Get artist details
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    return this.fetch<SpotifyArtist>(`/artists/${artistId}`);
  }

  /**
   * Get multiple artists
   */
  async getArtists(artistIds: string[]): Promise<{ artists: SpotifyArtist[] }> {
    const ids = artistIds.slice(0, 50).join(",");
    return this.fetch<{ artists: SpotifyArtist[] }>(`/artists?ids=${ids}`);
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<{
    id: string;
    display_name: string;
    email: string;
    images: { url: string }[];
  }> {
    return this.fetch("/me");
  }

  /**
   * Search for a track by name and artist
   * Returns the first matching track or null if not found
   */
  async searchTrack(
    trackName: string,
    artistName: string
  ): Promise<SpotifyTrack | null> {
    const query = encodeURIComponent(`track:${trackName} artist:${artistName}`);
    const result = await this.fetch<{
      tracks: { items: SpotifyTrack[] };
    }>(`/search?q=${query}&type=track&limit=1`);

    return result.tracks.items[0] || null;
  }

  /**
   * Get track by ID
   */
  async getTrack(trackId: string): Promise<SpotifyTrack> {
    return this.fetch<SpotifyTrack>(`/tracks/${trackId}`);
  }

  /**
   * Get multiple tracks by ID (max 50)
   */
  async getTracks(trackIds: string[]): Promise<{ tracks: SpotifyTrack[] }> {
    const ids = trackIds.slice(0, 50).join(",");
    return this.fetch<{ tracks: SpotifyTrack[] }>(`/tracks?ids=${ids}`);
  }

  /**
   * Get track recommendations based on a seed track
   * @param seedTrackId The track ID to base recommendations on
   * @param limit Number of recommendations (max 100, default 10)
   */
  async getRecommendations(
    seedTrackId: string,
    limit: number = 10
  ): Promise<{ tracks: SpotifyTrack[] }> {
    const params = new URLSearchParams({
      seed_tracks: seedTrackId,
      limit: String(limit),
    });
    return this.fetch<{ tracks: SpotifyTrack[] }>(`/recommendations?${params}`);
  }

  /**
   * Get related artists for a given artist
   * @param artistId The artist ID to find related artists for
   */
  async getRelatedArtists(
    artistId: string
  ): Promise<{ artists: SpotifyArtist[] }> {
    return this.fetch<{ artists: SpotifyArtist[] }>(
      `/artists/${artistId}/related-artists`
    );
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  return response.json();
}
