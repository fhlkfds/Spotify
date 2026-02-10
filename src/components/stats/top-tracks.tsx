import Image from "next/image";
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
            <div key={track.id} className="flex items-center gap-4">
              <span className="text-lg font-bold text-muted-foreground w-6">
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
                <p className="font-medium truncate">{track.name}</p>
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
            </div>
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
