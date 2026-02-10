"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GenreBarChart } from "@/components/charts/genre-bar-chart";
import { formatListeningTime } from "@/lib/utils";
import { ArrowLeft, Clock, Music, Users, Percent, Play, SkipForward } from "lucide-react";

interface TrackData {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
  playCount: number;
  totalListenedMs: number;
  genres: string[];
  mood: string;
  releaseYear: number | null;
}

interface PlaylistDetail {
  playlist: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    owner: string;
    totalTracks: number;
    totalDurationMs: number;
    isPublic: boolean;
    isCollaborative: boolean;
  };
  stats: {
    tracksPlayed: number;
    completionRate: number;
    totalListenedMs: number;
    listenedPercentage: number;
    avgPlaysPerTrack: number;
  };
  topGenres: { genre: string; count: number; percentage: number }[];
  topArtists: { id: string; name: string; imageUrl: string | null; count: number }[];
  moodDistribution: { mood: string; count: number; percentage: number }[];
  decadeDistribution: { decade: string; count: number }[];
  mostPlayed: TrackData[];
  unplayed: TrackData[];
  tracks: TrackData[];
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

export default function PlaylistDetailPage() {
  const params = useParams();
  const playlistId = params.id as string;
  const [data, setData] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlaylist() {
      try {
        const res = await fetch(`/api/stats/playlists/${playlistId}`);
        if (res.ok) {
          const playlistData = await res.json();
          setData(playlistData);
        } else {
          const err = await res.json();
          setError(err.error || "Failed to load playlist");
        }
      } catch (error) {
        console.error("Failed to fetch playlist:", error);
        setError("Failed to connect");
      } finally {
        setLoading(false);
      }
    }

    fetchPlaylist();
  }, [playlistId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/playlists">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Playlists
          </Button>
        </Link>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">{error || "Playlist not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { playlist, stats, topGenres, topArtists, moodDistribution, decadeDistribution, mostPlayed, unplayed } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-6">
        <Link href="/dashboard/playlists">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        {playlist.imageUrl ? (
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-32 h-32 rounded-lg object-cover shadow-lg"
          />
        ) : (
          <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center">
            <Music className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-muted-foreground mt-1">{playlist.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{playlist.totalTracks} tracks</span>
            <span>•</span>
            <span>{formatListeningTime(playlist.totalDurationMs)}</span>
            <span>•</span>
            <span>by {playlist.owner}</span>
          </div>
          <div className="flex gap-2 mt-3">
            {playlist.isPublic && <Badge variant="secondary">Public</Badge>}
            {playlist.isCollaborative && <Badge variant="secondary">Collaborative</Badge>}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-spotify-green/20 rounded-lg">
                <Percent className="h-5 w-5 text-spotify-green" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completionRate}%</p>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Play className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.tracksPlayed}</p>
                <p className="text-sm text-muted-foreground">Tracks Played</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatListeningTime(stats.totalListenedMs)}</p>
                <p className="text-sm text-muted-foreground">Time Listened</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <SkipForward className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgPlaysPerTrack}x</p>
                <p className="text-sm text-muted-foreground">Avg Plays/Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mood and Genre Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Mood Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {moodDistribution.map((m) => (
                <div key={m.mood} className="flex items-center gap-3">
                  <span className="text-2xl w-8">{moodEmojis[m.mood] || "🎵"}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{m.mood}</span>
                      <span className="text-sm text-muted-foreground">{m.percentage}%</span>
                    </div>
                    <Progress value={m.percentage} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Top Genres</CardTitle>
          </CardHeader>
          <CardContent>
            <GenreBarChart
              data={topGenres.map((g) => ({
                genre: g.genre,
                playCount: g.count,
                totalMs: g.count * 180000,
                artistCount: 1,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Artists and Decades */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Top Artists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topArtists.map((artist, index) => (
                <div key={artist.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </span>
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{artist.name}</p>
                    <p className="text-sm text-muted-foreground">{artist.count} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Era Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {decadeDistribution.map((d) => (
                <div key={d.decade} className="flex items-center gap-3">
                  <span className="w-12 font-mono text-sm">{d.decade}</span>
                  <div className="flex-1">
                    <Progress
                      value={(d.count / playlist.totalTracks) * 100}
                      className="h-3"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Played and Unplayed */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-spotify-green" />
              Most Played
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mostPlayed.length > 0 ? (
              <div className="space-y-3">
                {mostPlayed.slice(0, 5).map((track) => (
                  <div key={track.id} className="flex items-center gap-3">
                    {track.albumImageUrl ? (
                      <img src={track.albumImageUrl} alt={track.name} className="w-10 h-10 rounded" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{track.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{track.artistName}</p>
                    </div>
                    <Badge variant="secondary">{track.playCount}x</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No tracks played yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SkipForward className="h-5 w-5 text-orange-500" />
              Unplayed Tracks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unplayed.length > 0 ? (
              <div className="space-y-3">
                {unplayed.slice(0, 5).map((track) => (
                  <div key={track.id} className="flex items-center gap-3">
                    {track.albumImageUrl ? (
                      <img src={track.albumImageUrl} alt={track.name} className="w-10 h-10 rounded opacity-60" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-muted-foreground">{track.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{track.artistName}</p>
                    </div>
                  </div>
                ))}
                {unplayed.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{unplayed.length - 5} more unplayed
                  </p>
                )}
              </div>
            ) : (
              <p className="text-spotify-green text-center py-4">
                You've played every track!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
