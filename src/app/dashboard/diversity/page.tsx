"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DiversityGauge, DiversityRadial } from "@/components/charts/diversity-gauge";
import { DiversityTrendChart } from "@/components/charts/diversity-trend-chart";
import { StatCard } from "@/components/stats/stat-card";
import { Sparkles, Users, Tag, BarChart3, TrendingUp, TrendingDown } from "lucide-react";

interface DiversityData {
  scores: {
    overall: number;
    genreDiversity: number;
    artistDiversity: number;
    explorationScore: number;
    mainstreamScore: number;
    nicheScore: number;
  };
  breakdown: {
    totalGenres: number;
    totalArtists: number;
    totalPlays: number;
    avgGenresPerArtist: number;
    topGenreConcentration: number;
    top5GenreConcentration: number;
  };
  genreDistribution: {
    genre: string;
    playCount: number;
    totalMs: number;
    artistCount: number;
    percentage: number;
  }[];
  artistDistribution: {
    artistId: string;
    playCount: number;
    totalMs: number;
    genreCount: number;
    percentage: number;
  }[];
  diversityTrend: {
    month: string;
    genreCount: number;
    artistCount: number;
    totalMs: number;
  }[];
}

export default function DiversityPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DiversityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDiversity() {
      try {
        const res = await fetch(`/api/stats/diversity?${searchParams}`);
        if (res.ok) {
          const diversityData = await res.json();
          setData(diversityData);
        }
      } catch (error) {
        console.error("Failed to fetch diversity:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDiversity();
  }, [searchParams]);

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
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!data || data.breakdown.totalPlays === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Listening Diversity Score</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No listening data available yet. Sync your listening history to see your diversity scores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getDiversityLabel = (score: number) => {
    if (score >= 80) return "Highly Diverse";
    if (score >= 60) return "Very Diverse";
    if (score >= 40) return "Moderately Diverse";
    if (score >= 20) return "Somewhat Focused";
    return "Highly Focused";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Listening Diversity Score</h1>
        <p className="text-muted-foreground mt-1">
          Discover how varied your music taste is across genres and artists
        </p>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter />

      {/* Main Score Display */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-center">Overall Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <DiversityGauge
              score={data.scores.overall}
              label={getDiversityLabel(data.scores.overall)}
              size="lg"
            />
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Based on genre diversity, artist variety, and exploration habits
            </p>
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Genre Diversity</span>
                    <span className="text-sm text-muted-foreground">{data.scores.genreDiversity}%</span>
                  </div>
                  <Progress value={data.scores.genreDiversity} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    How evenly distributed your genre listening is
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Artist Diversity</span>
                    <span className="text-sm text-muted-foreground">{data.scores.artistDiversity}%</span>
                  </div>
                  <Progress value={data.scores.artistDiversity} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    How varied your artist selection is
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Exploration Score</span>
                    <span className="text-sm text-muted-foreground">{data.scores.explorationScore}%</span>
                  </div>
                  <Progress value={data.scores.explorationScore} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    How many different genres you've discovered
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <DiversityRadial scores={data.scores} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Genres"
          value={data.breakdown.totalGenres.toString()}
          description="Unique genres in your library"
          icon={Tag}
        />
        <StatCard
          title="Total Artists"
          value={data.breakdown.totalArtists.toString()}
          description="Unique artists listened to"
          icon={Users}
        />
        <StatCard
          title="Avg Genres/Artist"
          value={data.breakdown.avgGenresPerArtist.toString()}
          description="Genre variety per artist"
          icon={BarChart3}
        />
        <StatCard
          title="Top Genre Share"
          value={`${data.breakdown.topGenreConcentration}%`}
          description="Concentration in top genre"
          icon={Sparkles}
        />
      </div>

      {/* Diversity Trend */}
      {data.diversityTrend.length > 1 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Diversity Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <DiversityTrendChart data={data.diversityTrend} />
          </CardContent>
        </Card>
      )}

      {/* Mainstream vs Niche */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-spotify-green" />
              Mainstream Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <DiversityGauge
                score={data.scores.mainstreamScore}
                label=""
                size="md"
                showLabel={false}
              />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {data.scores.mainstreamScore >= 60
                    ? "You tend to listen to popular, well-known genres"
                    : data.scores.mainstreamScore >= 40
                    ? "You have a balanced mix of popular and niche music"
                    : "You prefer exploring less mainstream genres"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Top 5 genres make up {data.breakdown.top5GenreConcentration}% of your listening
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-blue-500" />
              Niche Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <DiversityGauge
                score={data.scores.nicheScore}
                label=""
                size="md"
                showLabel={false}
              />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {data.scores.nicheScore >= 60
                    ? "You're an adventurous listener who explores diverse sounds"
                    : data.scores.nicheScore >= 40
                    ? "You balance familiar favorites with new discoveries"
                    : "You prefer sticking to your favorite genres"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Your listening spans {data.breakdown.totalGenres} different genres
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Genre Distribution */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Genre Concentration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.genreDistribution.slice(0, 10).map((genre, index) => (
              <div key={genre.genre} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-6">#{index + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{genre.genre}</span>
                    <span className="text-sm text-muted-foreground">
                      {genre.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={genre.percentage}
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
