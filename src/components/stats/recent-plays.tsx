import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, formatTrackDuration } from "@/lib/utils";
import type { RecentPlay } from "@/types";

interface RecentPlaysProps {
  plays: RecentPlay[];
}

export function RecentPlays({ plays }: RecentPlaysProps) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Recent Plays</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {plays.map((play) => (
            <div key={play.id} className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded bg-muted flex-shrink-0">
                {play.albumImageUrl ? (
                  <Image
                    src={play.albumImageUrl}
                    alt={play.trackName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                    {play.trackName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{play.trackName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {play.artistName}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(new Date(play.playedAt))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTrackDuration(play.durationMs)}
                </p>
              </div>
            </div>
          ))}
          {plays.length === 0 && (
            <p className="text-muted-foreground text-center py-4 text-sm">
              No recent plays yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
