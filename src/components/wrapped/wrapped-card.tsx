"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WrappedCardProps {
  title: string;
  gradient?: string;
  children: React.ReactNode;
  className?: string;
}

export function WrappedCard({
  title,
  gradient = "from-spotify-green to-emerald-600",
  children,
  className,
}: WrappedCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0",
        `bg-gradient-to-br ${gradient}`,
        "text-white shadow-xl",
        className
      )}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative p-6">
        <h3 className="text-sm font-medium text-white/80 mb-2">{title}</h3>
        {children}
      </div>
    </Card>
  );
}

interface TopItemCardProps {
  rank: number;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  stat?: string;
}

export function TopItemCard({
  rank,
  title,
  subtitle,
  imageUrl,
  stat,
}: TopItemCardProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-white/10 backdrop-blur-sm">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 font-bold text-lg">
        {rank}
      </div>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          className="w-12 h-12 rounded-md object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{title}</p>
        <p className="text-sm text-white/70 truncate">{subtitle}</p>
      </div>
      {stat && (
        <div className="text-sm text-white/80 font-medium">{stat}</div>
      )}
    </div>
  );
}

interface StatDisplayProps {
  value: string | number;
  label: string;
  size?: "sm" | "md" | "lg";
}

export function StatDisplay({ value, label, size = "md" }: StatDisplayProps) {
  const sizeClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl",
  };

  return (
    <div className="text-center">
      <div className={cn("font-bold", sizeClasses[size])}>{value}</div>
      <div className="text-white/70 text-sm mt-1">{label}</div>
    </div>
  );
}

interface ShareableCardProps {
  period: string;
  topArtist?: { name: string; imageUrl?: string | null };
  topTrack?: { name: string; artistName: string };
  totalHours: number;
  totalTracks: number;
  topGenre?: string;
}

export function ShareableCard({
  period,
  topArtist,
  topTrack,
  totalHours,
  totalTracks,
  topGenre,
}: ShareableCardProps) {
  return (
    <div
      id="shareable-wrapped"
      className="w-[400px] h-[500px] bg-gradient-to-br from-spotify-green via-emerald-500 to-teal-600 rounded-2xl p-6 text-white relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-white/80 text-sm">My Music Wrapped</p>
          <h2 className="text-2xl font-bold">{period}</h2>
        </div>

        {/* Top Artist */}
        {topArtist && (
          <div className="text-center mb-4">
            {topArtist.imageUrl && (
              <img
                src={topArtist.imageUrl}
                alt={topArtist.name}
                className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-white/30"
              />
            )}
            <p className="text-white/70 text-xs">Top Artist</p>
            <p className="font-bold text-lg">{topArtist.name}</p>
          </div>
        )}

        {/* Top Track */}
        {topTrack && (
          <div className="text-center mb-4 px-4">
            <p className="text-white/70 text-xs">Top Track</p>
            <p className="font-semibold truncate">{topTrack.name}</p>
            <p className="text-white/70 text-sm truncate">{topTrack.artistName}</p>
          </div>
        )}

        {/* Stats */}
        <div className="flex-1 flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-3xl font-bold">{totalHours}</p>
            <p className="text-white/70 text-xs">Hours</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{totalTracks}</p>
            <p className="text-white/70 text-xs">Tracks</p>
          </div>
        </div>

        {/* Top Genre */}
        {topGenre && (
          <div className="text-center">
            <p className="text-white/70 text-xs">Top Genre</p>
            <p className="font-semibold capitalize">{topGenre}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-4 text-white/50 text-xs">
          Spotify Stats Tracker
        </div>
      </div>
    </div>
  );
}
