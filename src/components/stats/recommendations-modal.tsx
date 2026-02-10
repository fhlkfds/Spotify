"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ExternalLink, Music, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTrackDuration } from "@/lib/utils";
import type { RecommendedTrack, RecommendedArtist } from "@/types";

interface RecommendationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "track" | "artist";
  id: string;
  name: string;
}

export function RecommendationsModal({
  open,
  onOpenChange,
  type,
  id,
  name,
}: RecommendationsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackRecommendations, setTrackRecommendations] = useState<
    RecommendedTrack[]
  >([]);
  const [artistRecommendations, setArtistRecommendations] = useState<
    RecommendedArtist[]
  >([]);

  useEffect(() => {
    if (!open || !id) return;

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/recommendations?type=${type}&id=${id}`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch recommendations");
        }

        const data = await res.json();

        if (type === "track") {
          setTrackRecommendations(data.recommendations);
        } else {
          setArtistRecommendations(data.recommendations);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [open, id, type]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "track" ? (
              <Music className="h-5 w-5 text-spotify-green" />
            ) : (
              <User className="h-5 w-5 text-spotify-green" />
            )}
            {type === "track" ? "Similar Songs" : "Similar Artists"}
          </DialogTitle>
          <DialogDescription>
            Based on {type === "track" ? "the song" : "the artist"} &quot;{name}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </>
          ) : error ? (
            <p className="text-muted-foreground text-center py-4">{error}</p>
          ) : type === "track" ? (
            trackRecommendations.map((track, index) => (
              <a
                key={track.id}
                href={track.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <span className="text-lg font-bold text-muted-foreground w-6">
                  {index + 1}
                </span>
                <div className="relative h-12 w-12 overflow-hidden rounded-md bg-muted flex-shrink-0">
                  {track.albumImageUrl ? (
                    <Image
                      src={track.albumImageUrl}
                      alt={track.albumName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Music className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-spotify-green transition-colors">
                    {track.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {track.artistName}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{formatTrackDuration(track.durationMs)}</span>
                  <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </a>
            ))
          ) : (
            artistRecommendations.map((artist, index) => (
              <a
                key={artist.id}
                href={artist.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <span className="text-lg font-bold text-muted-foreground w-6">
                  {index + 1}
                </span>
                <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted flex-shrink-0">
                  {artist.imageUrl ? (
                    <Image
                      src={artist.imageUrl}
                      alt={artist.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-spotify-green transition-colors">
                    {artist.name}
                  </p>
                  {artist.genres.length > 0 && (
                    <p className="text-sm text-muted-foreground truncate">
                      {artist.genres.join(", ")}
                    </p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))
          )}

          {!loading &&
            !error &&
            ((type === "track" && trackRecommendations.length === 0) ||
              (type === "artist" && artistRecommendations.length === 0)) && (
              <p className="text-muted-foreground text-center py-4">
                No recommendations found.
              </p>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
