import type { SpotifyRecentlyPlayed, SpotifyArtist, SpotifyTrack, SpotifyPlaylist, SpotifyPlaylistTrack } from "@/types";

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
   * Get similar tracks by searching for other tracks by the same artist
   * This is a workaround since Spotify deprecated the /recommendations endpoint
   * @param seedTrackId The track ID to base similar tracks on
   * @param limit Number of similar tracks to return (default 10)
   */
  async getSimilarTracks(
    seedTrackId: string,
    limit: number = 10
  ): Promise<{ tracks: SpotifyTrack[] }> {
    // First get the seed track to find the artist
    const seedTrack = await this.getTrack(seedTrackId);
    const artistName = seedTrack.artists[0]?.name;

    if (!artistName) {
      return { tracks: [] };
    }

    // Search for more tracks by this artist
    const query = encodeURIComponent(`artist:${artistName}`);
    const result = await this.fetch<{
      tracks: { items: SpotifyTrack[] };
    }>(`/search?q=${query}&type=track&limit=${limit + 5}`);

    // Filter out the seed track and return up to limit tracks
    const tracks = result.tracks.items
      .filter((track) => track.id !== seedTrackId)
      .slice(0, limit);

    return { tracks };
  }

  /**
   * Get similar artists by searching for artists in the same genres
   * This is a workaround since Spotify deprecated the /artists/{id}/related-artists endpoint
   * @param artistId The artist ID to find similar artists for
   * @param limit Number of similar artists to return (default 10)
   */
  async getSimilarArtists(
    artistId: string,
    limit: number = 10
  ): Promise<{ artists: SpotifyArtist[] }> {
    // First get the artist to find their genres
    const artist = await this.getArtist(artistId);
    const genres = artist.genres.slice(0, 2); // Use top 2 genres

    if (genres.length === 0) {
      return { artists: [] };
    }

    // Search for artists in similar genres
    const genreQuery = genres.map((g) => `genre:"${g}"`).join(" ");
    const query = encodeURIComponent(genreQuery);
    const result = await this.fetch<{
      artists: { items: SpotifyArtist[] };
    }>(`/search?q=${query}&type=artist&limit=${limit + 5}`);

    // Filter out the original artist and return up to limit artists
    const artists = result.artists.items
      .filter((a) => a.id !== artistId)
      .slice(0, limit);

    return { artists };
  }

  /**
   * Get current user's playlists
   */
  async getUserPlaylists(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: SpotifyPlaylist[]; total: number }> {
    return this.fetch<{ items: SpotifyPlaylist[]; total: number }>(
      `/me/playlists?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Get a playlist's tracks
   */
  async getPlaylistTracks(
    playlistId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ items: SpotifyPlaylistTrack[]; total: number }> {
    return this.fetch<{ items: SpotifyPlaylistTrack[]; total: number }>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(added_at,track(id,name,duration_ms,album(id,name,images,release_date),artists(id,name))),total`
    );
  }

  /**
   * Get a playlist by ID
   */
  async getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
    return this.fetch<SpotifyPlaylist>(`/playlists/${playlistId}`);
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
