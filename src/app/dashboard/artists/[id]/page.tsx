"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Clock, Play, Calendar, Disc, Music } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stats/stat-card";
import { ListeningChart } from "@/components/charts/listening-chart";
import {
  formatListeningTime,
  formatDate,
  formatTrackDuration,
} from "@/lib/utils";

interface ArtistData {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
    genres: string[];
  };
  stats: {
    totalMs: number;
    playCount: number;
    firstPlay: string;
    lastPlay: string;
  };
  topTracks: {
    id: string;
    name: string;
    playCount: number;
    durationMs: number;
  }[];
  allTracks: {
    id: string;
    name: string;
    albumName: string;
    albumImageUrl: string | null;
    playCount: number;
    durationMs: number;
    totalMs: number;
    firstListen: string;
    lastListen: string;
  }[];
  topAlbums: {
    id: string;
    name: string;
    imageUrl: string | null;
    playCount: number;
    totalMs: number;
    trackCount: number;
  }[];
  listeningOverTime: {
    month: string;
    totalMs: number;
  }[];
}

export default function ArtistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArtistData() {
      try {
        const res = await fetch(`/api/stats/artists?artistId=${params.id}`);
        if (!res.ok) {
          throw new Error("Failed to fetch artist data");
        }
        const artistData = await res.json();
        setData(artistData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchArtistData();
    }
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
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              {error || "Artist not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { artist, stats, allTracks, topAlbums, listeningOverTime } = data;

  // Transform listeningOverTime for the chart (rename month to date)
  const chartData = listeningOverTime.map((item) => ({
    date: item.month,
    totalMs: item.totalMs,
  }));

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Artists
      </Button>

      {/* Artist Header */}
      <Card className="glass overflow-hidden">
        <div className="relative h-48 bg-gradient-to-br from-spotify-green/30 to-transparent">
          {artist.imageUrl && (
            <Image
              src={artist.imageUrl}
              alt={artist.name}
              fill
              className="object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-end gap-6">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-background shadow-xl">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-4xl font-bold">
                    {artist.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <h1 className="text-4xl font-bold text-white drop-shadow-lg truncate">
                  {artist.name}
                </h1>
                {artist.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {artist.genres.slice(0, 5).map((genre) => (
                      <span
                        key={genre}
                        className="px-3 py-1 text-sm rounded-full bg-spotify-green/20 text-spotify-green"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
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

      {/* Top Albums */}
      {topAlbums.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Disc className="h-5 w-5 text-spotify-green" />
              Top Albums
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topAlbums.slice(0, 6).map((album, index) => (
                <div
                  key={album.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="relative h-16 w-16 overflow-hidden rounded-md shadow-md flex-shrink-0">
                    {album.imageUrl ? (
                      <Image
                        src={album.imageUrl}
                        alt={album.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-bold">
                        <Disc className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-spotify-green text-background text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{album.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatListeningTime(album.totalMs)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {album.playCount} plays &middot; {album.trackCount} tracks
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* All Songs */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-spotify-green" />
            All Songs ({allTracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Album</div>
              <div className="col-span-1 text-center">Plays</div>
              <div className="col-span-2 text-center">First Listen</div>
              <div className="col-span-2 text-center">Last Listen</div>
            </div>

            {/* Track rows */}
            {allTracks.map((track, index) => (
              <div
                key={track.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Rank */}
                <div className="hidden md:flex col-span-1 items-center text-muted-foreground">
                  {index + 1}
                </div>

                {/* Track info with album art */}
                <div className="col-span-1 md:col-span-4 flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded shadow flex-shrink-0">
                    {track.albumImageUrl ? (
                      <Image
                        src={track.albumImageUrl}
                        alt={track.albumName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-xs">
                        <Music className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{track.name}</p>
                    <p className="text-sm text-muted-foreground md:hidden truncate">
                      {track.albumName}
                    </p>
                  </div>
                </div>

                {/* Album (hidden on mobile) */}
                <div className="hidden md:flex col-span-2 items-center">
                  <p className="text-sm text-muted-foreground truncate">
                    {track.albumName}
                  </p>
                </div>

                {/* Plays */}
                <div className="hidden md:flex col-span-1 items-center justify-center">
                  <span className="text-sm font-medium">{track.playCount}</span>
                </div>

                {/* First Listen */}
                <div className="hidden md:flex col-span-2 items-center justify-center">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(new Date(track.firstListen))}
                  </span>
                </div>

                {/* Last Listen */}
                <div className="hidden md:flex col-span-2 items-center justify-center">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(new Date(track.lastListen))}
                  </span>
                </div>

                {/* Mobile stats */}
                <div className="md:hidden flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{track.playCount} plays</span>
                  <span>First: {formatDate(new Date(track.firstListen))}</span>
                  <span>Last: {formatDate(new Date(track.lastListen))}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
