"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GenreBarChart } from "@/components/charts/genre-bar-chart";
import { GenrePieChart } from "@/components/charts/genre-pie-chart";
import { StatCard } from "@/components/stats/stat-card";
import { formatListeningTime } from "@/lib/utils";
import { Tag, Trophy, Sparkles, Music } from "lucide-react";

interface GenreData {
  genre: string;
  playCount: number;
  totalMs: number;
  artistCount: number;
}

interface GenresData {
  topGenres: GenreData[];
  stats: {
    totalGenres: number;
    topGenre: string | null;
    diversityScore: number;
    totalListeningMs: number;
  };
}

export default function GenresPage() {
  const [data, setData] = useState<GenresData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGenres() {
      try {
        const res = await fetch("/api/stats/genres");
        if (res.ok) {
          const genresData = await res.json();
          setData(genresData);
        }
      } catch (error) {
        console.error("Failed to fetch genres:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchGenres();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
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

  if (!data || data.topGenres.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Genre Analytics</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No genre data available yet. Sync your listening history to see genre analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Genre Analytics</h1>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Genres"
          value={data.stats.totalGenres.toString()}
          description="Unique genres listened to"
          icon={Tag}
        />
        <StatCard
          title="Top Genre"
          value={data.stats.topGenre || "N/A"}
          description="Most listened genre"
          icon={Trophy}
          className="capitalize"
        />
        <StatCard
          title="Diversity Score"
          value={`${data.stats.diversityScore}%`}
          description="How varied your taste is"
          icon={Sparkles}
        />
        <StatCard
          title="Total Listening"
          value={formatListeningTime(data.stats.totalListeningMs)}
          description="Across all genres"
          icon={Music}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Top 10 Genres by Listening Time</CardTitle>
          </CardHeader>
          <CardContent>
            <GenreBarChart data={data.topGenres} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Genre Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <GenrePieChart data={data.topGenres} />
          </CardContent>
        </Card>
      </div>

      {/* All Genres List */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>All Genres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
            {data.topGenres.map((genre, index) => (
              <Link
                key={genre.genre}
                href={`/dashboard/genres/${encodeURIComponent(genre.genre)}`}
              >
                <Badge
                  variant={index < 3 ? "default" : "secondary"}
                  className={`capitalize cursor-pointer ${index < 3 ? "bg-spotify-green hover:bg-spotify-green/80" : ""}`}
                >
                  {genre.genre}
                  <span className="ml-1 text-xs opacity-70">
                    ({genre.playCount})
                  </span>
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Genre Details Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Genre Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Rank</th>
                  <th className="text-left py-3 px-4 font-medium">Genre</th>
                  <th className="text-right py-3 px-4 font-medium">Listening Time</th>
                  <th className="text-right py-3 px-4 font-medium">Plays</th>
                  <th className="text-right py-3 px-4 font-medium">Artists</th>
                </tr>
              </thead>
              <tbody>
                {data.topGenres.slice(0, 20).map((genre, index) => (
                  <tr
                    key={genre.genre}
                    className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                    onClick={() => window.location.href = `/dashboard/genres/${encodeURIComponent(genre.genre)}`}
                  >
                    <td className="py-3 px-4 text-muted-foreground">#{index + 1}</td>
                    <td className="py-3 px-4 capitalize font-medium text-spotify-green hover:underline">{genre.genre}</td>
                    <td className="py-3 px-4 text-right">{formatListeningTime(genre.totalMs)}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{genre.playCount}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{genre.artistCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
