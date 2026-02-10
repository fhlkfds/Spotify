"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatListeningTime } from "@/lib/utils";
import type { TopArtist } from "@/types";

interface TopArtistsProps {
  artists: TopArtist[];
}

export function TopArtists({ artists }: TopArtistsProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Top Artists</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {artists.map((artist, index) => (
            <Link
              key={artist.id}
              href={`/dashboard/artists/${artist.id}`}
              className="flex items-center gap-4 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
            >
              <span className="text-lg font-bold text-muted-foreground w-8 text-right">
                {index + 1}
              </span>
              <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold">
                    {artist.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate hover:text-spotify-green transition-colors">
                  {artist.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {artist.playCount} plays
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium text-spotify-green">
                  {formatListeningTime(artist.totalMs)}
                </p>
              </div>
            </Link>
          ))}
          {artists.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No data yet. Sync your listening history to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
