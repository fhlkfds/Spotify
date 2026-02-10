"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendationsModal } from "@/components/stats/recommendations-modal";
import { formatListeningTime } from "@/lib/utils";
import type { TopArtist } from "@/types";

interface TopArtistsProps {
  artists: TopArtist[];
}

export function TopArtists({ artists }: TopArtistsProps) {
  const [selectedArtist, setSelectedArtist] = useState<TopArtist | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleArtistClick = (artist: TopArtist) => {
    setSelectedArtist(artist);
    setModalOpen(true);
  };

  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle>Top Artists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {artists.map((artist, index) => (
              <div
                key={artist.id}
                className="flex items-center gap-4 cursor-pointer rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                onClick={() => handleArtistClick(artist)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleArtistClick(artist)}
              >
                <span className="text-lg font-bold text-muted-foreground w-6">
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
              </div>
            ))}
            {artists.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No data yet. Sync your listening history to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedArtist && (
        <RecommendationsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          type="artist"
          id={selectedArtist.id}
          name={selectedArtist.name}
        />
      )}
    </>
  );
}
