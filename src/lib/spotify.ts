import type { SpotifyRecentlyPlayed, SpotifyArtist } from "@/types";

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
