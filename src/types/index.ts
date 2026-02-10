export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  artists: {
    id: string;
    name: string;
  }[];
}

export interface SpotifyRecentlyPlayed {
  items: {
    track: SpotifyTrack;
    played_at: string;
  }[];
  next: string | null;
  cursors: {
    after: string;
    before: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; height: number; width: number }[];
  genres: string[];
}

export interface TopArtist {
  id: string;
  name: string;
  imageUrl: string | null;
  playCount: number;
  totalMs: number;
}

export interface TopTrack {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
  playCount: number;
  totalMs: number;
}

export interface TopAlbum {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string | null;
  playCount: number;
  totalMs: number;
  trackCount: number;
  tracksPlayed: number;
}

export interface ListeningStats {
  totalMs: number;
  totalPlays: number;
  uniqueArtists: number;
  uniqueTracks: number;
  uniqueAlbums: number;
}

export interface DailyListening {
  date: string;
  totalMs: number;
  playCount: number;
}

export interface HourlyDistribution {
  hour: number;
  totalMs: number;
  playCount: number;
}

export interface RecentPlay {
  id: string;
  trackName: string;
  artistName: string;
  albumImageUrl: string | null;
  playedAt: Date;
  durationMs: number;
}

export interface HeatmapData {
  date: string;
  count: number;
  level: number; // 0-4 for intensity
}

export interface TimeRange {
  label: string;
  value: "today" | "week" | "month" | "all";
  startDate: Date;
}

// Spotify Import Types

// StreamingHistory format (Account Data - last year)
export interface StreamingHistoryEntry {
  endTime: string;           // "2024-01-15 14:30"
  artistName: string;
  trackName: string;
  msPlayed: number;
}

// Extended streaming history format (Full history)
export interface ExtendedHistoryEntry {
  ts: string;                // ISO timestamp
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;  // "spotify:track:xxx"
  ms_played: number;
}

// Normalized entry for processing
export interface NormalizedHistoryEntry {
  playedAt: Date;
  artistName: string;
  trackName: string;
  albumName: string | null;
  trackId: string | null;    // Only available in extended format
  msPlayed: number;
}

// Import result types
export interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  failed: number;
  skipped: number;  // Tracks played < 30 seconds
  errors: string[];
}

export interface ImportProgress {
  total: number;
  processed: number;
  imported: number;
  duplicates: number;
  failed: number;
  skipped: number;
}

export interface ShareLink {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date | null;
  viewCount: number;
}

export interface SharedStats {
  userName: string;
  userImage: string | null;
  stats: ListeningStats;
  topArtists: TopArtist[];
  topTracks: TopTrack[];
  recentPlays: RecentPlay[];
  viewCount: number;
  createdAt: Date;
}

// Recommendation types
export interface RecommendedTrack {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
  spotifyUrl: string;
}

export interface RecommendedArtist {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  spotifyUrl: string;
}
