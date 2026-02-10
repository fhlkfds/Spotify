"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stats/stat-card";
import { formatListeningTime } from "@/lib/utils";
import { Flame, Heart, Music, Users, TrendingUp, Clock, Zap } from "lucide-react";

interface ObsessionPeriod {
  startDate: string;
  endDate: string;
  peakDate: string;
  playCount: number;
  totalMs: number;
  avgPlaysPerDay: number;
}

interface ObsessedTrack {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
  obsessionPeriod: ObsessionPeriod;
  totalPlays: number;
  currentStatus: "active" | "cooling" | "past";
  intensity: number;
}

interface ObsessedArtist {
  id: string;
  name: string;
  imageUrl: string | null;
  obsessionPeriod: ObsessionPeriod;
  totalPlays: number;
  topTracks: { name: string; playCount: number }[];
  currentStatus: "active" | "cooling" | "past";
  intensity: number;
}

interface ObsessedData {
  obsessedTracks: ObsessedTrack[];
  obsessedArtists: ObsessedArtist[];
  currentObsessions: (ObsessedTrack | ObsessedArtist)[];
  pastObsessions: (ObsessedTrack | ObsessedArtist)[];
  stats: {
    totalTracksAnalyzed: number;
    totalArtistsAnalyzed: number;
    obsessionTracksFound: number;
    obsessionArtistsFound: number;
  };
  message?: string;
}

const statusColors = {
  active: "bg-red-500/20 text-red-400 border-red-500/30",
  cooling: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  past: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const statusLabels = {
  active: "Currently Obsessed",
  cooling: "Cooling Off",
  past: "Past Obsession",
};

const statusEmojis = {
  active: "🔥",
  cooling: "✨",
  past: "💫",
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (startStr === endStr) return startStr;
  return `${startStr} - ${endStr}`;
}

function IntensityMeter({ intensity }: { intensity: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            intensity >= 80
              ? "bg-red-500"
              : intensity >= 60
              ? "bg-orange-500"
              : intensity >= 40
              ? "bg-yellow-500"
              : "bg-green-500"
          }`}
          style={{ width: `${intensity}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8">{intensity}%</span>
    </div>
  );
}

export default function ObsessedPage() {
  const [data, setData] = useState<ObsessedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(180);

  useEffect(() => {
    async function fetchObsessed() {
      try {
        setLoading(true);
        const res = await fetch(`/api/stats/obsessed?days=${days}`);
        if (res.ok) {
          const obsessedData = await res.json();
          setData(obsessedData);
        }
      } catch (error) {
        console.error("Failed to fetch obsessed:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchObsessed();
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.message) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Songs You Obsessed Over</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <div className="text-center">
              <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {data?.message || "Keep listening! We need more data to detect your musical obsessions."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Songs You Obsessed Over</h1>
          <p className="text-muted-foreground mt-1">
            Tracks and artists you played on repeat during intense listening periods
          </p>
        </div>
        <div className="flex gap-2">
          {[90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                days === d
                  ? "bg-spotify-green text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {d === 365 ? "1y" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Track Obsessions"
          value={data.stats.obsessionTracksFound.toString()}
          description="Songs you played on repeat"
          icon={Music}
        />
        <StatCard
          title="Artist Obsessions"
          value={data.stats.obsessionArtistsFound.toString()}
          description="Artists you binged"
          icon={Users}
        />
        <StatCard
          title="Tracks Analyzed"
          value={data.stats.totalTracksAnalyzed.toString()}
          description="In your listening history"
          icon={TrendingUp}
        />
        <StatCard
          title="Time Period"
          value={`${days} days`}
          description="Analyzed for patterns"
          icon={Clock}
        />
      </div>

      {/* Current Obsessions */}
      {data.currentObsessions.length > 0 && (
        <Card className="glass border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Currently Obsessed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {data.currentObsessions.map((item) => {
                const isTrack = "artistName" in item;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    {"albumImageUrl" in item && item.albumImageUrl ? (
                      <img src={item.albumImageUrl} alt={item.name} className="w-16 h-16 rounded-lg" />
                    ) : "imageUrl" in item && item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-full" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        {isTrack ? <Music className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{item.name}</span>
                        <span className="text-lg">🔥</span>
                      </div>
                      {"artistName" in item && (
                        <p className="text-sm text-muted-foreground truncate">{item.artistName}</p>
                      )}
                      <div className="mt-2">
                        <IntensityMeter intensity={item.intensity} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.obsessionPeriod.avgPlaysPerDay}x/day • {item.totalPlays} total plays
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Obsessed Tracks */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Track Obsessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.obsessedTracks.length > 0 ? (
            <div className="space-y-4">
              {data.obsessedTracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted font-bold">
                    {index + 1}
                  </div>
                  {track.albumImageUrl ? (
                    <img src={track.albumImageUrl} alt={track.name} className="w-14 h-14 rounded-lg" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                      <Music className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{track.name}</span>
                      <Badge className={statusColors[track.currentStatus]}>
                        {statusEmojis[track.currentStatus]} {statusLabels[track.currentStatus]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{track.artistName}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {track.obsessionPeriod.avgPlaysPerDay}x/day peak
                      </span>
                      <span>
                        {formatDateRange(track.obsessionPeriod.startDate, track.obsessionPeriod.endDate)}
                      </span>
                      <span>{track.totalPlays} total plays</span>
                    </div>
                  </div>
                  <div className="w-24">
                    <p className="text-xs text-muted-foreground mb-1">Intensity</p>
                    <IntensityMeter intensity={track.intensity} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No track obsessions detected yet. Keep listening!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Obsessed Artists */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Artist Obsessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.obsessedArtists.length > 0 ? (
            <div className="space-y-4">
              {data.obsessedArtists.map((artist, index) => (
                <div
                  key={artist.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted font-bold">
                    {index + 1}
                  </div>
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} className="w-14 h-14 rounded-full" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{artist.name}</span>
                      <Badge className={statusColors[artist.currentStatus]}>
                        {statusEmojis[artist.currentStatus]} {statusLabels[artist.currentStatus]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {artist.topTracks.map((t) => (
                        <Badge key={t.name} variant="secondary" className="text-xs">
                          {t.name} ({t.playCount}x)
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {artist.obsessionPeriod.avgPlaysPerDay}x/day peak
                      </span>
                      <span>
                        {formatDateRange(artist.obsessionPeriod.startDate, artist.obsessionPeriod.endDate)}
                      </span>
                      <span>{artist.totalPlays} total plays</span>
                    </div>
                  </div>
                  <div className="w-24">
                    <p className="text-xs text-muted-foreground mb-1">Intensity</p>
                    <IntensityMeter intensity={artist.intensity} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No artist obsessions detected yet. Keep listening!
            </p>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>How Obsession Detection Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-medium mb-1">Spike Detection</h3>
              <p className="text-sm text-muted-foreground">
                We look for periods where you played a song 2x+ more than your average
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl mb-2">📅</div>
              <h3 className="font-medium mb-1">Time Windows</h3>
              <p className="text-sm text-muted-foreground">
                We analyze 1-3 week windows to find sustained listening bursts
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl mb-2">🔥</div>
              <h3 className="font-medium mb-1">Intensity Score</h3>
              <p className="text-sm text-muted-foreground">
                Combines spike magnitude and duration for an overall obsession rating
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
