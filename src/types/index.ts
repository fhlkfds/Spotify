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
