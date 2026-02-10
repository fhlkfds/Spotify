"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatListeningTime } from "@/lib/utils";
import { Trophy, Users, Sparkles, Compass } from "lucide-react";

interface CompareData {
  userStats: {
    totalMs: number;
    hoursPerWeek: number;
    uniqueArtists: number;
    uniqueTracks: number;
    genreCount: number;
    discoveryScore: number;
  };
  comparison: {
    percentile: number;
    rank: number;
    totalUsers: number;
    avgHoursPerWeek: number;
  };
  globalStats: {
    totalUsers: number;
    avgHoursPerWeek: number;
    topGenres: string[];
  };
}

export default function ComparePage() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchComparison() {
      try {
        const res = await fetch("/api/stats/compare");
        if (res.ok) {
          const compareData = await res.json();
          setData(compareData);
        }
      } catch (error) {
        console.error("Failed to fetch comparison:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchComparison();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const percentileLabel = data?.comparison.percentile
    ? data.comparison.percentile >= 90
      ? "Top 10%"
      : data.comparison.percentile >= 75
        ? "Top 25%"
        : data.comparison.percentile >= 50
          ? "Top 50%"
          : "Getting started"
    : "N/A";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Compare</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ranking Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Your Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-spotify-green">
                {percentileLabel}
              </div>
              <p className="text-muted-foreground mt-2">
                Rank #{data?.comparison.rank || "-"} of{" "}
                {data?.comparison.totalUsers || 0} listeners
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Your percentile</span>
                <span className="font-medium">
                  {data?.comparison.percentile || 0}%
                </span>
              </div>
              <Progress
                value={data?.comparison.percentile || 0}
                className="h-3"
              />
            </div>
          </CardContent>
        </Card>

        {/* Listening Comparison */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Listening Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Your Weekly</p>
                <p className="text-2xl font-bold text-spotify-green">
                  {data?.userStats.hoursPerWeek.toFixed(1) || 0}h
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Global Average</p>
                <p className="text-2xl font-bold">
                  {data?.globalStats.avgHoursPerWeek.toFixed(1) || 0}h
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total listening (30 days)</span>
                <span className="font-medium">
                  {formatListeningTime(data?.userStats.totalMs || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unique artists</span>
                <span className="font-medium">
                  {data?.userStats.uniqueArtists || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unique tracks</span>
                <span className="font-medium">
                  {data?.userStats.uniqueTracks || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Genre Diversity */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Genre Diversity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold">
                {data?.userStats.genreCount || 0}
              </div>
              <p className="text-muted-foreground">Genres explored</p>
            </div>
            {data?.globalStats.topGenres &&
              data.globalStats.topGenres.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Popular genres on the platform:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.globalStats.topGenres.slice(0, 8).map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-1 rounded-full bg-muted text-xs"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Discovery Score */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5" />
              Discovery Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-spotify-green">
                {data?.userStats.discoveryScore || 0}%
              </div>
              <p className="text-muted-foreground">New artist discovery rate</p>
            </div>
            <div className="space-y-2">
              <Progress
                value={data?.userStats.discoveryScore || 0}
                className="h-3"
              />
              <p className="text-xs text-muted-foreground text-center">
                Percentage of new artists in the last 30 days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
