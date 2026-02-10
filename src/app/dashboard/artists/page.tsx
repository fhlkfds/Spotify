"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatListeningTime, formatDate } from "@/lib/utils";

interface Artist {
  id: string;
  name: string;
  imageUrl: string | null;
  totalMs: number;
  playCount: number;
  firstPlay: string;
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArtists() {
      try {
        const res = await fetch("/api/stats/artists");
        if (res.ok) {
          const data = await res.json();
          setArtists(data.artists);
        }
      } catch (error) {
        console.error("Failed to fetch artists:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchArtists();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Artists</h1>
        <p className="text-muted-foreground">
          {artists.length} artists in your library
        </p>
      </div>

      {artists.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No artist data yet. Sync your listening history to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist, index) => (
            <Card key={artist.id} className="glass overflow-hidden">
              <div className="relative h-32 bg-gradient-to-br from-spotify-green/20 to-transparent">
                {artist.imageUrl && (
                  <Image
                    src={artist.imageUrl}
                    alt={artist.name}
                    fill
                    className="object-cover opacity-50"
                  />
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-end gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-background shadow-lg">
                      {artist.imageUrl ? (
                        <Image
                          src={artist.imageUrl}
                          alt={artist.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-bold">
                          {artist.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg truncate text-white drop-shadow-lg">
                        {artist.name}
                      </p>
                      <p className="text-sm text-white/80 drop-shadow">
                        #{index + 1} Artist
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Time</p>
                    <p className="font-semibold text-spotify-green">
                      {formatListeningTime(artist.totalMs)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Plays</p>
                    <p className="font-semibold">{artist.playCount}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">First Listened</p>
                    <p className="font-semibold">
                      {formatDate(new Date(artist.firstPlay))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
