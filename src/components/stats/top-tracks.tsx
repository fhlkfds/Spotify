"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTrackDuration } from "@/lib/utils";
import type { TopTrack } from "@/types";

interface TopTracksProps {
  tracks: TopTrack[];
}

export function TopTracks({ tracks }: TopTracksProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Top Tracks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tracks.map((track, index) => (
            <Link
              key={track.id}
              href={`/dashboard/tracks/${track.id}`}
              className="flex items-center gap-4 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
            >
              <span className="text-lg font-bold text-muted-foreground w-8 text-right">
                {index + 1}
              </span>
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-muted">
                {track.albumImageUrl ? (
                  <Image
                    src={track.albumImageUrl}
                    alt={track.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold">
                    {track.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate hover:text-spotify-green transition-colors">
                  {track.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {track.artistName}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{track.playCount} plays</p>
                <p className="text-sm text-muted-foreground">
                  {formatTrackDuration(track.totalMs / track.playCount)}
                </p>
              </div>
            </Link>
          ))}
          {tracks.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No data yet. Sync your listening history to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
