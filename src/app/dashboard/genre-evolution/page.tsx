"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GenreEvolutionChart } from "@/components/charts/genre-evolution-chart";
import { StatCard } from "@/components/stats/stat-card";
import { TrendingUp, TrendingDown, Sparkles, History, ArrowUp, ArrowDown } from "lucide-react";

interface GenreEvolutionData {
  monthlyGenreData: Record<string, number | string>[];
  genreRankings: Record<string, { month: string; rank: number; percentage: number }[]>;
  topGenres: string[];
  topGenresOverTime: Record<string, number | string>[];
  newlyDiscoveredGenres: {
    genre: string;
    discoveredAt: string;
    totalMs: number;
  }[];
  decliningGenres: {
    genre: string;
    recentAvg: number;
    olderAvg: number;
    change: number;
  }[];
  risingGenres: {
    genre: string;
    recentAvg: number;
    olderAvg: number;
    change: number;
  }[];
}

export default function GenreEvolutionPage() {
  const [data, setData] = useState<GenreEvolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/stats/genre-evolution?months=${months}`);
        if (res.ok) {
          const evolutionData = await res.json();
          setData(evolutionData);
        }
      } catch (error) {
        console.error("Failed to fetch genre evolution:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [months]);

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

  if (!data || data.topGenresOverTime.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Genre Evolution</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No listening history available yet. Sync your data to see how your taste evolves over time.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Genre Evolution</h1>
          <p className="text-muted-foreground mt-1">
            Track how your music taste changes over time
          </p>
        </div>
        <div className="flex gap-2">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                months === m
                  ? "bg-spotify-green text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {m}mo
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Genres Tracked"
          value={data.topGenres.length.toString()}
          description="Top genres in your evolution"
          icon={History}
        />
        <StatCard
          title="Rising Genres"
          value={data.risingGenres.length.toString()}
          description="Genres gaining popularity"
          icon={TrendingUp}
        />
        <StatCard
          title="Declining Genres"
          value={data.decliningGenres.length.toString()}
          description="Genres you're listening less"
          icon={TrendingDown}
        />
        <StatCard
          title="New Discoveries"
          value={data.newlyDiscoveredGenres.length.toString()}
          description="Genres discovered recently"
          icon={Sparkles}
        />
      </div>

      {/* Main Evolution Chart */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Genre Distribution Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <GenreEvolutionChart
            data={data.topGenresOverTime}
            genres={data.topGenres}
          />
        </CardContent>
      </Card>

      {/* Rising and Declining Genres */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-green-500" />
              Rising Genres
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.risingGenres.length > 0 ? (
              <div className="space-y-4">
                {data.risingGenres.map((genre) => (
                  <div
                    key={genre.genre}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <span className="font-medium capitalize">{genre.genre}</span>
                      <p className="text-xs text-muted-foreground">
                        {genre.olderAvg.toFixed(1)}% → {genre.recentAvg.toFixed(1)}%
                      </p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                      +{genre.change.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No significant rising genres detected
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-red-500" />
              Declining Genres
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.decliningGenres.length > 0 ? (
              <div className="space-y-4">
                {data.decliningGenres.map((genre) => (
                  <div
                    key={genre.genre}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <span className="font-medium capitalize">{genre.genre}</span>
                      <p className="text-xs text-muted-foreground">
                        {genre.olderAvg.toFixed(1)}% → {genre.recentAvg.toFixed(1)}%
                      </p>
                    </div>
                    <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/30">
                      {genre.change.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No significant declining genres detected
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Newly Discovered Genres */}
      {data.newlyDiscoveredGenres.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-spotify-green" />
              Recently Discovered Genres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.newlyDiscoveredGenres.map((genre) => {
                const discoveredDate = new Date(genre.discoveredAt);
                return (
                  <div
                    key={genre.genre}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <Badge variant="outline" className="capitalize">
                      {genre.genre}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {discoveredDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Genre Rankings Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Top Genres by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Genre</th>
                  {data.topGenresOverTime.slice(-6).map((d) => {
                    const [year, month] = (d.month as string).split("-");
                    const date = new Date(parseInt(year), parseInt(month) - 1);
                    return (
                      <th key={d.month as string} className="text-center py-3 px-2 font-medium">
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.topGenres.slice(0, 10).map((genre) => (
                  <tr key={genre} className="border-b border-border/50">
                    <td className="py-3 px-2 font-medium capitalize">{genre}</td>
                    {data.topGenresOverTime.slice(-6).map((d) => {
                      const value = d[genre] as number;
                      return (
                        <td
                          key={d.month as string}
                          className="text-center py-3 px-2"
                        >
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs ${
                              value > 10
                                ? "bg-spotify-green/20 text-spotify-green"
                                : value > 5
                                ? "bg-green-500/10 text-green-500"
                                : value > 0
                                ? "text-muted-foreground"
                                : "text-muted-foreground/50"
                            }`}
                          >
                            {value > 0 ? `${value.toFixed(1)}%` : "-"}
                          </span>
                        </td>
                      );
                    })}
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
