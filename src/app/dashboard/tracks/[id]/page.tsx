"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Play,
  Calendar,
  Music,
  User,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stats/stat-card";
import { ListeningChart } from "@/components/charts/listening-chart";
import { formatListeningTime, formatDate, formatTrackDuration } from "@/lib/utils";
import type { RecommendedTrack } from "@/types";

interface TrackData {
  track: {
    id: string;
    name: string;
    durationMs: number;
    artist: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
    album: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
  };
  stats: {
    totalMs: number;
    playCount: number;
    firstPlay: string;
    lastPlay: string;
  };
  listeningOverTime: {
    month: string;
    totalMs: number;
  }[];
  recentPlays: {
    id: string;
    playedAt: string;
  }[];
}

export default function TrackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTrack[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrackData() {
      try {
        const res = await fetch(`/api/stats/tracks?trackId=${params.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch track data");
        }
        const trackData = await res.json();
        setData(trackData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchTrackData();
    }
  }, [params.id]);

  useEffect(() => {
    async function fetchRecommendations() {
      if (!params.id) return;

      setRecLoading(true);
      setRecError(null);

      try {
        const res = await fetch(`/api/recommendations?type=track&id=${params.id}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to fetch recommendations");
        }
        const recData = await res.json();
        setRecommendations(recData.recommendations || []);
      } catch (err) {
        setRecError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setRecLoading(false);
      }
    }

    fetchRecommendations();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              {error || "Track not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { track, stats, listeningOverTime } = data;

  // Transform listeningOverTime for the chart
  const chartData = listeningOverTime.map((item) => ({
    date: item.month,
    totalMs: item.totalMs,
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Track Header */}
      <Card className="glass overflow-hidden">
        <div className="relative h-48 bg-gradient-to-br from-spotify-green/30 to-transparent">
          {track.album.imageUrl && (
            <Image
              src={track.album.imageUrl}
              alt={track.album.name}
              fill
              className="object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-end gap-6">
              <div className="relative h-32 w-32 overflow-hidden rounded-lg border-4 border-background shadow-xl">
                {track.album.imageUrl ? (
                  <Image
                    src={track.album.imageUrl}
                    alt={track.album.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-4xl font-bold">
                    <Music className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <h1 className="text-4xl font-bold text-white drop-shadow-lg truncate">
                  {track.name}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <Link
                    href={`/dashboard/artists/${track.artist.id}`}
                    className="text-lg text-white/80 hover:text-spotify-green transition-colors"
                  >
                    {track.artist.name}
                  </Link>
                  <span className="text-white/60">•</span>
                  <span className="text-white/60">{track.album.name}</span>
                </div>
                <p className="text-sm text-white/60 mt-1">
                  {formatTrackDuration(track.durationMs)}
                </p>
              </div>
              <a
                href={`https://open.spotify.com/track/${track.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open in Spotify
                </Button>
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Listening Time"
          value={formatListeningTime(stats.totalMs)}
          icon={Clock}
        />
        <StatCard
          title="Total Plays"
          value={stats.playCount.toLocaleString()}
          icon={Play}
        />
        <StatCard
          title="First Listened"
          value={formatDate(new Date(stats.firstPlay))}
          icon={Calendar}
        />
        <StatCard
          title="Last Listened"
          value={formatDate(new Date(stats.lastPlay))}
          icon={Calendar}
        />
      </div>

      {/* Listening Over Time */}
      {chartData.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Listening Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ListeningChart data={chartData} />
          </CardContent>
        </Card>
      )}

      {/* Similar Songs (Recommendations) */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-spotify-green" />
            Similar Songs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recError ? (
            <p className="text-muted-foreground text-center py-4">{recError}</p>
          ) : recommendations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recommendations found.
            </p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <a
                  key={rec.id}
                  href={rec.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <div className="relative h-12 w-12 overflow-hidden rounded-md bg-muted flex-shrink-0">
                    {rec.albumImageUrl ? (
                      <Image
                        src={rec.albumImageUrl}
                        alt={rec.albumName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Music className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate group-hover:text-spotify-green transition-colors">
                      {rec.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {rec.artistName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatTrackDuration(rec.durationMs)}</span>
                    <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
