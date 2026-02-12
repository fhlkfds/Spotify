"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { ListeningChart } from "@/components/charts/listening-chart";
import { HourlyChart } from "@/components/charts/hourly-chart";
import { Heatmap } from "@/components/charts/heatmap";
import { StatCard } from "@/components/stats/stat-card";
import { formatListeningTime } from "@/lib/utils";
import { Flame, TrendingUp, Clock, Calendar } from "lucide-react";

interface TrendsData {
  dailyListening: { date: string; totalMs: number; playCount: number }[];
  hourlyDistribution: { hour: number; totalMs: number; playCount: number }[];
  streak: number;
  heatmapData: { date: string; count: number }[];
}

export default function TrendsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrends() {
      try {
        const params = new URLSearchParams(searchParams.toString());
        params.set("days", "90");
        const res = await fetch(`/api/stats/trends?${params}`);
        if (res.ok) {
          const trendsData = await res.json();
          setData(trendsData);
        }
      } catch (error) {
        console.error("Failed to fetch trends:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrends();
  }, [searchParams]);

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

  // Calculate stats
  const totalMs = data?.dailyListening.reduce((sum, d) => sum + d.totalMs, 0) || 0;
  const totalPlays = data?.dailyListening.reduce((sum, d) => sum + d.playCount, 0) || 0;
  const avgPerDay = data?.dailyListening.length
    ? totalMs / data.dailyListening.length
    : 0;

  // Find peak hour
  const peakHour = data?.hourlyDistribution.reduce(
    (max, h) => (h.totalMs > max.totalMs ? h : max),
    { hour: 0, totalMs: 0, playCount: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Listening Trends</h1>
        <p className="text-muted-foreground mt-1">
          Analyze your listening patterns over time
        </p>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter />

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Current Streak"
          value={`${data?.streak || 0} days`}
          description="Consecutive days with activity"
          icon={Flame}
        />
        <StatCard
          title="Total (90 days)"
          value={formatListeningTime(totalMs)}
          description={`${totalPlays} plays`}
          icon={TrendingUp}
        />
        <StatCard
          title="Daily Average"
          value={formatListeningTime(avgPerDay)}
          description="Per active day"
          icon={Calendar}
        />
        <StatCard
          title="Peak Hour"
          value={`${peakHour?.hour.toString().padStart(2, "0")}:00`}
          description="Most active listening time"
          icon={Clock}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Daily Listening (Last 90 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.dailyListening && data.dailyListening.length > 0 ? (
              <ListeningChart data={data.dailyListening} />
            ) : (
              <p className="text-muted-foreground text-center py-12">
                No data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Listening by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.hourlyDistribution ? (
              <HourlyChart data={data.hourlyDistribution} />
            ) : (
              <p className="text-muted-foreground text-center py-12">
                No data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Heatmap */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Activity Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.heatmapData && data.heatmapData.length > 0 ? (
            <Heatmap data={data.heatmapData} weeks={13} />
          ) : (
            <p className="text-muted-foreground text-center py-12">
              No activity data yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
