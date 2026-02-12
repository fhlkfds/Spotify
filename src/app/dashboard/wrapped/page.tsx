"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import {
  WrappedCard,
  TopItemCard,
  StatDisplay,
  ShareableCard,
} from "@/components/wrapped/wrapped-card";
import { StatCard } from "@/components/stats/stat-card";
import { HourlyChart } from "@/components/charts/hourly-chart";
import {
  Music,
  Clock,
  Users,
  Disc3,
  Calendar,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface WrappedData {
  period: string;
  periodType: string;
  hasData: boolean;
  stats: {
    totalMs: number;
    totalMinutes: number;
    totalHours: number;
    totalDays: number;
    totalPlays: number;
    uniqueArtists: number;
    uniqueTracks: number;
    uniqueAlbums: number;
    uniqueGenres: number;
    avgMinutesPerDay: number;
    peakHour: number;
    peakDay: string;
  } | null;
  topArtists: {
    id: string;
    name: string;
    imageUrl: string | null;
    playCount: number;
    totalMs: number;
  }[];
  topTracks: {
    id: string;
    name: string;
    artistName: string;
    albumImageUrl: string | null;
    playCount: number;
    totalMs: number;
  }[];
  topAlbums: {
    id: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    playCount: number;
    totalMs: number;
  }[];
  topGenres: {
    genre: string;
    playCount: number;
    totalMs: number;
  }[];
  funFacts: string[];
  hourlyDistribution: { hour: number; totalMs: number }[];
  dayOfWeekDistribution: { day: number; dayName: string; totalMs: number }[];
}

export default function WrappedPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<"month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [showShareCard, setShowShareCard] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const fetchWrapped = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", periodType);
      params.set("year", selectedYear.toString());
      params.set("month", selectedMonth.toString());
      const res = await fetch(`/api/stats/wrapped?${params}`);
      if (res.ok) {
        const wrappedData = await res.json();
        setData(wrappedData);
      }
    } catch (error) {
      console.error("Failed to fetch wrapped:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWrapped();
  }, [periodType, selectedYear, selectedMonth, searchParams]);

  const handlePrevPeriod = () => {
    if (periodType === "month") {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      setSelectedYear(selectedYear - 1);
    }
  };

  const handleNextPeriod = () => {
    const now = new Date();
    if (periodType === "month") {
      if (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth() + 1) {
        return;
      }
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    } else {
      if (selectedYear >= now.getFullYear()) return;
      setSelectedYear(selectedYear + 1);
    }
  };

  const downloadShareCard = async () => {
    if (!shareCardRef.current) return;

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `wrapped-${data?.period.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Wrapped</h1>
          <p className="text-muted-foreground mt-1">
            Spotify Wrapped-style summaries for any time period
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={periodType === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodType("month")}
            >
              Monthly
            </Button>
            <Button
              variant={periodType === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriodType("year")}
            >
              Yearly
            </Button>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <Card className="glass">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrevPeriod}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center min-w-[200px]">
              <h2 className="text-2xl font-bold">{data?.period || "Select Period"}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextPeriod}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Date Range Filter */}
      <DateRangeFilter />

      {!data?.hasData ? (
        <Card className="glass">
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              No listening data available for this period. Try selecting a different time range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Main Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <WrappedCard title="Total Listening Time" gradient="from-spotify-green to-emerald-600">
              <StatDisplay
                value={data.stats!.totalHours}
                label="hours listened"
                size="lg"
              />
            </WrappedCard>
            <WrappedCard title="Tracks Played" gradient="from-blue-500 to-blue-600">
              <StatDisplay
                value={data.stats!.totalPlays.toLocaleString()}
                label="total plays"
                size="lg"
              />
            </WrappedCard>
            <WrappedCard title="Artists Discovered" gradient="from-purple-500 to-purple-600">
              <StatDisplay
                value={data.stats!.uniqueArtists}
                label="unique artists"
                size="lg"
              />
            </WrappedCard>
            <WrappedCard title="Daily Average" gradient="from-pink-500 to-pink-600">
              <StatDisplay
                value={data.stats!.avgMinutesPerDay}
                label="minutes per day"
                size="lg"
              />
            </WrappedCard>
          </div>

          {/* Top Artists and Tracks */}
          <div className="grid gap-6 lg:grid-cols-2">
            <WrappedCard title="Your Top Artists" gradient="from-orange-500 to-red-500" className="h-auto">
              <div className="space-y-3 mt-4">
                {data.topArtists.slice(0, 5).map((artist, index) => (
                  <TopItemCard
                    key={artist.id}
                    rank={index + 1}
                    title={artist.name}
                    subtitle={`${artist.playCount} plays`}
                    imageUrl={artist.imageUrl}
                    stat={formatTime(artist.totalMs)}
                  />
                ))}
              </div>
            </WrappedCard>

            <WrappedCard title="Your Top Tracks" gradient="from-cyan-500 to-blue-500" className="h-auto">
              <div className="space-y-3 mt-4">
                {data.topTracks.slice(0, 5).map((track, index) => (
                  <TopItemCard
                    key={track.id}
                    rank={index + 1}
                    title={track.name}
                    subtitle={track.artistName}
                    imageUrl={track.albumImageUrl}
                    stat={`${track.playCount}x`}
                  />
                ))}
              </div>
            </WrappedCard>
          </div>

          {/* Fun Facts */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Fun Facts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.funFacts.map((fact, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border"
                  >
                    <p className="text-sm">{fact}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Unique Tracks"
              value={data.stats!.uniqueTracks.toString()}
              description="Different songs played"
              icon={Music}
            />
            <StatCard
              title="Albums Explored"
              value={data.stats!.uniqueAlbums.toString()}
              description="Unique albums"
              icon={Disc3}
            />
            <StatCard
              title="Peak Hour"
              value={`${data.stats!.peakHour}:00`}
              description="Most active time"
              icon={Clock}
            />
            <StatCard
              title="Peak Day"
              value={data.stats!.peakDay}
              description="Most active day"
              icon={Calendar}
            />
          </div>

          {/* Top Genres and Albums */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Top Genres</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topGenres.slice(0, 5).map((genre, index) => (
                    <div
                      key={genre.genre}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-spotify-green/20 text-spotify-green text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium capitalize">{genre.genre}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatTime(genre.totalMs)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Top Albums</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topAlbums.map((album, index) => (
                    <div
                      key={album.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-spotify-green/20 text-spotify-green text-sm font-bold">
                        {index + 1}
                      </span>
                      {album.imageUrl && (
                        <img
                          src={album.imageUrl}
                          alt={album.name}
                          className="w-10 h-10 rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{album.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {album.artistName}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Distribution */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>When You Listened</CardTitle>
            </CardHeader>
            <CardContent>
              <HourlyChart
                data={data.hourlyDistribution.map((h) => ({
                  ...h,
                  playCount: 0,
                }))}
              />
            </CardContent>
          </Card>

          {/* Share Button */}
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setShowShareCard(!showShareCard)}
              className="bg-spotify-green hover:bg-spotify-green/90"
            >
              <Share2 className="h-5 w-5 mr-2" />
              {showShareCard ? "Hide" : "Create"} Shareable Card
            </Button>
          </div>

          {/* Shareable Card */}
          {showShareCard && (
            <div className="flex flex-col items-center gap-4">
              <div ref={shareCardRef}>
                <ShareableCard
                  period={data.period}
                  topArtist={data.topArtists[0]}
                  topTrack={data.topTracks[0]}
                  totalHours={data.stats!.totalHours}
                  totalTracks={data.stats!.uniqueTracks}
                  topGenre={data.topGenres[0]?.genre}
                />
              </div>
              <Button onClick={downloadShareCard} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Image
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
