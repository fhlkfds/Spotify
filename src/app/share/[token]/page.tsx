"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { StatCard } from "@/components/stats/stat-card";
import { TopArtists } from "@/components/stats/top-artists";
import { TopTracks } from "@/components/stats/top-tracks";
import { RecentPlays } from "@/components/stats/recent-plays";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatListeningTime } from "@/lib/utils";
import { Clock, Music, Users, Disc3, Eye } from "lucide-react";
import type { SharedStats } from "@/types";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function SharePage({ params }: SharePageProps) {
  const { token } = use(params);
  const [data, setData] = useState<SharedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          const errorData = await res.json();
          setError(errorData.error || "Failed to load shared stats");
          return;
        }
        const statsData = await res.json();
        setData(statsData);
      } catch {
        setError("Failed to load shared stats");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  if (loading) {
    return <SharePageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-2xl font-bold mb-2">Oops!</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
              {data?.userImage ? (
                <Image
                  src={data.userImage}
                  alt={data.userName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold">
                  {data?.userName.charAt(0) || "U"}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {data?.userName}&apos;s Listening History
              </h1>
              <p className="text-muted-foreground">All-time stats</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="text-sm">{data?.viewCount} views</span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </div>

        {/* Top Artists and Tracks */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TopArtists artists={data?.topArtists || []} />
          <TopTracks tracks={data?.topTracks || []} />
        </div>

        {/* Recent Plays */}
        <div className="max-w-2xl">
          <RecentPlays plays={data?.recentPlays || []} />
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-6 border-t">
          <p>
            Powered by Spotify Stats Tracker
          </p>
        </div>
      </div>
    </div>
  );
}

function SharePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}
