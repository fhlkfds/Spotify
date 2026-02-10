"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stats/stat-card";
import { TopArtists } from "@/components/stats/top-artists";
import { TopTracks } from "@/components/stats/top-tracks";
import { TopGenres } from "@/components/stats/top-genres";
import { NewArtists } from "@/components/stats/new-artists";
import { RecentPlays } from "@/components/stats/recent-plays";
import { Heatmap } from "@/components/charts/heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatListeningTime } from "@/lib/utils";
import { Clock, Music, Users, Disc3, Flame } from "lucide-react";
import type { ListeningStats, TopArtist, TopTrack, RecentPlay, NewArtist } from "@/types";

interface DashboardData {
  stats: ListeningStats;
  topArtists: TopArtist[];
  topTracks: TopTrack[];
  recentPlays: RecentPlay[];
}

interface TrendsData {
  heatmapData: { date: string; count: number }[];
  streak: number;
}

interface GenreData {
  genre: string;
  playCount: number;
  totalMs: number;
  artistCount: number;
}

interface GenresData {
  topGenres: GenreData[];
}

interface NewArtistsData {
  newArtists: NewArtist[];
}

export default function DashboardPage() {
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("week");
  const [data, setData] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [genres, setGenres] = useState<GenresData | null>(null);
  const [newArtists, setNewArtists] = useState<NewArtistsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statsRes, trendsRes, genresRes, newArtistsRes] = await Promise.all([
          fetch(`/api/stats?range=${range}`),
          fetch("/api/stats/trends?days=365"),
          fetch("/api/stats/genres"),
          fetch("/api/stats/new-artists"),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setData(statsData);
        }

        if (trendsRes.ok) {
          const trendsData = await trendsRes.json();
          setTrends(trendsData);
        }

        if (genresRes.ok) {
          const genresData = await genresRes.json();
          setGenres(genresData);
        }

        if (newArtistsRes.ok) {
          const newArtistsData = await newArtistsRes.json();
          setNewArtists(newArtistsData);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [range]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Listening Time"
          value={formatListeningTime(data?.stats.totalMs || 0)}
          icon={Clock}
        />
        <StatCard
          title="Total Plays"
          value={data?.stats.totalPlays || 0}
          icon={Music}
        />
        <StatCard
          title="Unique Artists"
          value={data?.stats.uniqueArtists || 0}
          icon={Users}
        />
        <StatCard
          title="Unique Albums"
          value={data?.stats.uniqueAlbums || 0}
          icon={Disc3}
        />
        <StatCard
          title="Current Streak"
          value={`${trends?.streak || 0} days`}
          icon={Flame}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TopArtists artists={data?.topArtists || []} />
        <TopTracks tracks={data?.topTracks || []} />
        <TopGenres genres={genres?.topGenres || []} />
      </div>

      {/* New Artists This Month */}
      <div className="grid gap-6 lg:grid-cols-3">
        <NewArtists artists={newArtists?.newArtists || []} />
      </div>

      {/* Heatmap and Recent Plays */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle>Listening Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Heatmap data={trends?.heatmapData || []} />
          </CardContent>
        </Card>
        <RecentPlays plays={data?.recentPlays || []} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
