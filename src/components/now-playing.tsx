"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Music, Pause, Play, Volume2, Smartphone, Laptop, Speaker } from "lucide-react";

interface NowPlayingData {
  isPlaying: boolean;
  track: {
    id: string;
    name: string;
    artistName: string;
    albumName: string;
    albumImageUrl: string | null;
    durationMs: number;
    progressMs: number;
    spotifyUrl: string | null;
  } | null;
  device: {
    name: string;
    type: string;
    volume: number;
  } | null;
  error?: string;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function DeviceIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case "smartphone":
      return <Smartphone className="h-3 w-3" />;
    case "computer":
      return <Laptop className="h-3 w-3" />;
    case "speaker":
      return <Speaker className="h-3 w-3" />;
    default:
      return <Volume2 className="h-3 w-3" />;
  }
}

export function NowPlaying() {
  const [data, setData] = useState<NowPlayingData | null>(null);
  const [localProgress, setLocalProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/now-playing");
      if (res.ok) {
        const nowPlayingData = await res.json();
        setData(nowPlayingData);
        if (nowPlayingData.track) {
          setLocalProgress(nowPlayingData.track.progressMs);
        }
      }
    } catch (error) {
      console.error("Failed to fetch now playing:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch now playing every 10 seconds
  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying]);

  // Update local progress every second when playing
  useEffect(() => {
    if (!data?.isPlaying || !data?.track) return;

    const interval = setInterval(() => {
      setLocalProgress((prev) => {
        const next = prev + 1000;
        return next > data.track!.durationMs ? data.track!.durationMs : next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.isPlaying, data?.track]);

  if (loading) {
    return (
      <Card className="glass animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.track) {
    return (
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center">
              <Music className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-muted-foreground">Nothing Playing</p>
              <p className="text-sm text-muted-foreground/70">
                Play something on Spotify to see it here
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = (localProgress / data.track.durationMs) * 100;

  return (
    <Card className="glass border-spotify-green/30 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          {/* Album Art */}
          <div className="relative flex-shrink-0">
            {data.track.albumImageUrl ? (
              <img
                src={data.track.albumImageUrl}
                alt={data.track.albumName}
                className="w-16 h-16 rounded-lg object-cover shadow-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <Music className="h-6 w-6" />
              </div>
            )}
            {/* Playing indicator */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-spotify-green flex items-center justify-center shadow-lg">
              {data.isPlaying ? (
                <div className="flex items-center gap-0.5">
                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-white rounded-full animate-pulse delay-75" />
                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse delay-150" />
                </div>
              ) : (
                <Pause className="h-3 w-3 text-white" />
              )}
            </div>
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-spotify-green uppercase tracking-wider">
                {data.isPlaying ? "Now Playing" : "Paused"}
              </span>
            </div>
            <a
              href={data.track.spotifyUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold truncate block hover:text-spotify-green transition-colors"
            >
              {data.track.name}
            </a>
            <p className="text-sm text-muted-foreground truncate">
              {data.track.artistName}
            </p>
          </div>

          {/* Device Info */}
          {data.device && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <DeviceIcon type={data.device.type} />
              <span className="truncate max-w-[100px]">{data.device.name}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-3">
          <Progress value={progressPercent} className="h-1" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(localProgress)}</span>
            <span>{formatTime(data.track.durationMs)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for sidebar or smaller spaces
export function NowPlayingCompact() {
  const [data, setData] = useState<NowPlayingData | null>(null);

  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        const res = await fetch("/api/now-playing");
        if (res.ok) {
          const nowPlayingData = await res.json();
          setData(nowPlayingData);
        }
      } catch (error) {
        console.error("Failed to fetch now playing:", error);
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!data?.track) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-spotify-green/10 border border-spotify-green/20">
      {data.track.albumImageUrl ? (
        <img
          src={data.track.albumImageUrl}
          alt={data.track.albumName}
          className="w-10 h-10 rounded"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
          <Music className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{data.track.name}</p>
        <p className="text-xs text-muted-foreground truncate">{data.track.artistName}</p>
      </div>
      {data.isPlaying ? (
        <div className="flex items-center gap-0.5">
          <span className="w-0.5 h-2 bg-spotify-green rounded-full animate-pulse" />
          <span className="w-0.5 h-3 bg-spotify-green rounded-full animate-pulse delay-75" />
          <span className="w-0.5 h-2 bg-spotify-green rounded-full animate-pulse delay-150" />
        </div>
      ) : (
        <Pause className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}
