"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stats/stat-card";
import { formatListeningTime } from "@/lib/utils";
import { ListMusic, Clock, Users, Percent, Sparkles } from "lucide-react";

interface PlaylistData {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  totalTracks: number;
  totalDurationMs: number;
  owner: string;
  genres: { genre: string; count: number; percentage: number }[];
  mood: {
    primary: string;
    secondary: string | null;
    score: number;
  };
  artists: { id: string; name: string; count: number }[];
  decades: { decade: string; count: number }[];
  completionRate: number;
  tracksPlayed: number;
}

interface PlaylistsResponse {
  playlists: PlaylistData[];
  totalPlaylists: number;
}

const moodEmojis: Record<string, string> = {
  energetic: "💪",
  chill: "😌",
  happy: "😄",
  sad: "😢",
  romantic: "💕",
  focus: "🎯",
  angry: "😤",
  varied: "🎵",
};

const moodColors: Record<string, string> = {
  energetic: "bg-red-500/20 text-red-400",
  chill: "bg-green-500/20 text-green-400",
  happy: "bg-yellow-500/20 text-yellow-400",
  sad: "bg-blue-500/20 text-blue-400",
  romantic: "bg-pink-500/20 text-pink-400",
  focus: "bg-purple-500/20 text-purple-400",
  angry: "bg-orange-500/20 text-orange-400",
  varied: "bg-gray-500/20 text-gray-400",
};

export default function PlaylistsPage() {
  const [data, setData] = useState<PlaylistsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const res = await fetch("/api/stats/playlists");
        if (res.ok) {
          const playlistsData = await res.json();
          setData(playlistsData);
        } else {
          const err = await res.json();
          setError(err.error || "Failed to load playlists");
        }
      } catch (error) {
        console.error("Failed to fetch playlists:", error);
        setError("Failed to connect");
      } finally {
        setLoading(false);
      }
    }

    fetchPlaylists();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Playlist Analyzer</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || data.playlists.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Playlist Analyzer</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No playlists found. Create some playlists on Spotify to analyze them here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate aggregate stats
  const totalTracks = data.playlists.reduce((sum, p) => sum + p.totalTracks, 0);
  const totalDuration = data.playlists.reduce((sum, p) => sum + p.totalDurationMs, 0);
  const avgCompletion = Math.round(
    data.playlists.reduce((sum, p) => sum + p.completionRate, 0) / data.playlists.length
  );
  const mostCompletePlaylists = data.playlists.filter((p) => p.completionRate >= 80).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Playlist Analyzer</h1>
        <p className="text-muted-foreground mt-1">
          Deep dive into your playlist compositions, moods, and listening patterns
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Playlists"
          value={data.totalPlaylists.toString()}
          description={`${data.playlists.length} analyzed`}
          icon={ListMusic}
        />
        <StatCard
          title="Total Tracks"
          value={totalTracks.toString()}
          description="Across all playlists"
          icon={Users}
        />
        <StatCard
          title="Total Duration"
          value={formatListeningTime(totalDuration)}
          description="Combined playlist length"
          icon={Clock}
        />
        <StatCard
          title="Avg Completion"
          value={`${avgCompletion}%`}
          description={`${mostCompletePlaylists} fully explored`}
          icon={Percent}
        />
      </div>

      {/* Playlists Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.playlists.map((playlist) => (
          <Link
            key={playlist.id}
            href={`/dashboard/playlists/${playlist.id}`}
          >
            <Card className="glass h-full hover:border-spotify-green/50 transition-colors cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  {playlist.imageUrl ? (
                    <img
                      src={playlist.imageUrl}
                      alt={playlist.name}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                      <ListMusic className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{playlist.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {playlist.totalTracks} tracks • {formatListeningTime(playlist.totalDurationMs)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mood Badge */}
                <div className="flex items-center gap-2">
                  <Badge className={moodColors[playlist.mood.primary] || moodColors.varied}>
                    {moodEmojis[playlist.mood.primary] || "🎵"} {playlist.mood.primary}
                  </Badge>
                  {playlist.mood.secondary && (
                    <Badge variant="outline" className="text-xs">
                      + {playlist.mood.secondary}
                    </Badge>
                  )}
                </div>

                {/* Top Genres */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Top Genres</p>
                  <div className="flex flex-wrap gap-1">
                    {playlist.genres.slice(0, 3).map((g) => (
                      <Badge key={g.genre} variant="secondary" className="text-xs capitalize">
                        {g.genre}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Completion Rate */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Completion</span>
                    <span className={playlist.completionRate >= 80 ? "text-spotify-green" : ""}>
                      {playlist.completionRate}%
                    </span>
                  </div>
                  <Progress value={playlist.completionRate} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {playlist.tracksPlayed} of {playlist.totalTracks} tracks played
                  </p>
                </div>

                {/* Decades */}
                {playlist.decades.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    <span>
                      Mostly {playlist.decades[0]?.decade}
                      {playlist.decades[1] && ` & ${playlist.decades[1].decade}`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
