"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatListeningTime, formatDate } from "@/lib/utils";

interface Album {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string | null;
  totalMs: number;
  playCount: number;
  tracksPlayed: number;
  totalTracks: number;
  firstPlay: string;
  completionRate: number;
}

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAlbums() {
      try {
        const res = await fetch("/api/stats/albums");
        if (res.ok) {
          const data = await res.json();
          setAlbums(data.albums);
        }
      } catch (error) {
        console.error("Failed to fetch albums:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAlbums();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Albums</h1>
        <p className="text-muted-foreground">
          {albums.length} albums in your library
        </p>
      </div>

      {albums.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No album data yet. Sync your listening history to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album, index) => (
            <Card key={album.id} className="glass overflow-hidden">
              <div className="flex gap-4 p-4">
                <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md shadow-lg">
                  {album.imageUrl ? (
                    <Image
                      src={album.imageUrl}
                      alt={album.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-bold">
                      {album.name.charAt(0)}
                    </div>
                  )}
                  <div className="absolute top-1 left-1 bg-background/80 rounded px-1.5 py-0.5 text-xs font-bold">
                    #{index + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{album.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {album.artistName}
                  </p>
                  <p className="text-spotify-green font-semibold mt-2">
                    {formatListeningTime(album.totalMs)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {album.playCount} plays
                  </p>
                </div>
              </div>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">
                        Album Completion
                      </span>
                      <span className="font-medium">
                        {album.tracksPlayed}/{album.totalTracks} tracks
                      </span>
                    </div>
                    <Progress value={album.completionRate} className="h-2" />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discovered</span>
                    <span>{formatDate(new Date(album.firstPlay))}</span>
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
