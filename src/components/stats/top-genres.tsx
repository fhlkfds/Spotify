"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tag } from "lucide-react";
import { formatListeningTime } from "@/lib/utils";

interface Genre {
  genre: string;
  playCount: number;
  totalMs: number;
  artistCount: number;
}

interface TopGenresProps {
  genres: Genre[];
}

export function TopGenres({ genres }: TopGenresProps) {
  if (genres.length === 0) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Top Genres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No genre data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxMs = genres[0]?.totalMs || 1;

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Top Genres
        </CardTitle>
        <Link
          href="/dashboard/genres"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {genres.slice(0, 5).map((genre, index) => (
            <Link
              key={genre.genre}
              href={`/dashboard/genres/${encodeURIComponent(genre.genre)}`}
              className="block group"
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-5 text-right text-sm">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize truncate group-hover:text-spotify-green transition-colors">
                      {genre.genre}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatListeningTime(genre.totalMs)}
                    </span>
                  </div>
                  <Progress
                    value={(genre.totalMs / maxMs) * 100}
                    className="h-2"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {genre.playCount} plays
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {genre.artistCount} artists
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
