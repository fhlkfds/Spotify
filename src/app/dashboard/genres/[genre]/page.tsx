"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatCard } from "@/components/stats/stat-card";
import { formatListeningTime } from "@/lib/utils";
import { ArrowLeft, Music, Users, Clock, Disc3 } from "lucide-react";

interface Artist {
  id: string;
  name: string;
  imageUrl: string | null;
  playCount: number;
  totalMs: number;
}

interface Track {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  albumImageUrl: string | null;
  playCount: number;
  totalMs: number;
}

interface GenreDetailData {
  genre: string;
  artists: Artist[];
  tracks: Track[];
  stats: {
    totalPlays: number;
    totalMs: number;
    uniqueArtists: number;
    uniqueTracks: number;
  };
}

export default function GenreDetailPage() {
  const params = useParams();
  const genre = decodeURIComponent(params.genre as string);
  const [data, setData] = useState<GenreDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGenreDetails() {
      try {
        const res = await fetch(`/api/stats/genres/${encodeURIComponent(genre)}`);
        if (res.ok) {
          const genreData = await res.json();
          setData(genreData);
        }
      } catch (error) {
        console.error("Failed to fetch genre details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchGenreDetails();
  }, [genre]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/genres"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Genres
        </Link>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              Genre not found or no data available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/genres"
          className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-3xl font-bold capitalize">{genre}</h1>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Listening Time"
          value={formatListeningTime(data.stats.totalMs)}
          icon={Clock}
        />
        <StatCard
          title="Total Plays"
          value={data.stats.totalPlays.toString()}
          icon={Music}
        />
        <StatCard
          title="Artists"
          value={data.stats.uniqueArtists.toString()}
          icon={Users}
        />
        <StatCard
          title="Tracks"
          value={data.stats.uniqueTracks.toString()}
          icon={Disc3}
        />
      </div>

      {/* Artists and Tracks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Artists */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Artists in {genre}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.artists.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No artists found for this genre.
              </p>
            ) : (
              <div className="space-y-3">
                {data.artists.map((artist, index) => (
                  <Link
                    key={artist.id}
                    href={`/dashboard/artists/${artist.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-muted-foreground w-6 text-right">
                      #{index + 1}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={artist.imageUrl || undefined} />
                      <AvatarFallback>
                        {artist.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{artist.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {artist.playCount} plays
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatListeningTime(artist.totalMs)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tracks */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Top Tracks in {genre}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.tracks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tracks found for this genre.
              </p>
            ) : (
              <div className="space-y-3">
                {data.tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-muted-foreground w-6 text-right">
                      #{index + 1}
                    </span>
                    <Avatar className="h-10 w-10 rounded">
                      <AvatarImage src={track.albumImageUrl || undefined} />
                      <AvatarFallback className="rounded">
                        {track.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{track.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {track.artistName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{track.playCount} plays</p>
                      <p className="text-xs text-muted-foreground">
                        {formatListeningTime(track.totalMs)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
