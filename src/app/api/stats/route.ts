import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getDateRangeFromSearchParams,
} from "@/lib/utils";

const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Get date range from search params
    const { startDate, endDate } = getDateRangeFromSearchParams(searchParams);

    const [aggregateRows, topArtistRows, topTrackRows, recentPlaysRaw] =
      await Promise.all([
        prisma.$queryRaw<
          Array<{
            total_ms: number;
            total_plays: number;
            unique_artists: number;
            unique_tracks: number;
            unique_albums: number;
          }>
        >`
          SELECT
            COALESCE(SUM("Track"."durationMs"), 0) AS total_ms,
            COUNT(*) AS total_plays,
            COUNT(DISTINCT "Play"."artistId") AS unique_artists,
            COUNT(DISTINCT "Play"."trackId") AS unique_tracks,
            COUNT(DISTINCT "Play"."albumId") AS unique_albums
          FROM "Play"
          INNER JOIN "Track" ON "Track"."id" = "Play"."trackId"
          WHERE
            "Play"."userId" = ${userId}
            AND "Play"."playedAt" >= ${startDate}
            AND "Play"."playedAt" <= ${endDate}
        `,
        prisma.$queryRaw<
          Array<{ artist_id: string; play_count: number; total_ms: number }>
        >`
          SELECT
            "Play"."artistId" AS artist_id,
            COUNT(*) AS play_count,
            COALESCE(SUM("Track"."durationMs"), 0) AS total_ms
          FROM "Play"
          INNER JOIN "Track" ON "Track"."id" = "Play"."trackId"
          WHERE
            "Play"."userId" = ${userId}
            AND "Play"."playedAt" >= ${startDate}
            AND "Play"."playedAt" <= ${endDate}
          GROUP BY "Play"."artistId"
          ORDER BY total_ms DESC
          LIMIT 5
        `,
        prisma.$queryRaw<
          Array<{ track_id: string; play_count: number; total_ms: number }>
        >`
          SELECT
            "Play"."trackId" AS track_id,
            COUNT(*) AS play_count,
            COALESCE(SUM("Track"."durationMs"), 0) AS total_ms
          FROM "Play"
          INNER JOIN "Track" ON "Track"."id" = "Play"."trackId"
          WHERE
            "Play"."userId" = ${userId}
            AND "Play"."playedAt" >= ${startDate}
            AND "Play"."playedAt" <= ${endDate}
          GROUP BY "Play"."trackId"
          ORDER BY play_count DESC
          LIMIT 5
        `,
        prisma.play.findMany({
          where: {
            userId,
            playedAt: { gte: startDate, lte: endDate },
          },
          orderBy: { playedAt: "desc" },
          take: 10,
          select: {
            id: true,
            playedAt: true,
            track: { select: { name: true, durationMs: true } },
            artist: { select: { name: true } },
            album: { select: { imageUrl: true } },
          },
        }),
      ]);

    const aggregates = aggregateRows[0] || {
      total_ms: 0,
      total_plays: 0,
      unique_artists: 0,
      unique_tracks: 0,
      unique_albums: 0,
    };

    const artistIds = topArtistRows.map((row) => row.artist_id);
    const trackIds = topTrackRows.map((row) => row.track_id);

    const [artistRecords, trackRecords] = await Promise.all([
      artistIds.length
        ? prisma.artist.findMany({
            where: { id: { in: artistIds } },
            select: { id: true, name: true, imageUrl: true },
          })
        : Promise.resolve([]),
      trackIds.length
        ? prisma.track.findMany({
            where: { id: { in: trackIds } },
            select: {
              id: true,
              name: true,
              artist: { select: { name: true } },
              album: { select: { imageUrl: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const artistsById = new Map(artistRecords.map((artist) => [artist.id, artist]));
    const tracksById = new Map(trackRecords.map((track) => [track.id, track]));

    const topArtists = topArtistRows
      .map((row) => {
        const artist = artistsById.get(row.artist_id);
        if (!artist) {
          return null;
        }
        return {
          id: artist.id,
          name: artist.name,
          imageUrl: artist.imageUrl,
          playCount: Number(row.play_count),
          totalMs: Number(row.total_ms),
        };
      })
      .filter((artist): artist is NonNullable<typeof artist> => artist !== null);

    const topTracks = topTrackRows
      .map((row) => {
        const track = tracksById.get(row.track_id);
        if (!track) {
          return null;
        }
        return {
          id: track.id,
          name: track.name,
          artistName: track.artist.name,
          albumImageUrl: track.album.imageUrl,
          playCount: Number(row.play_count),
          totalMs: Number(row.total_ms),
        };
      })
      .filter((track): track is NonNullable<typeof track> => track !== null);

    const recentPlays = recentPlaysRaw.map((p) => ({
      id: p.id,
      trackName: p.track.name,
      artistName: p.artist.name,
      albumImageUrl: p.album.imageUrl,
      playedAt: p.playedAt,
      durationMs: p.track.durationMs,
    }));

    return NextResponse.json({
      stats: {
        totalMs: Number(aggregates.total_ms),
        totalPlays: Number(aggregates.total_plays),
        uniqueArtists: Number(aggregates.unique_artists),
        uniqueTracks: Number(aggregates.unique_tracks),
        uniqueAlbums: Number(aggregates.unique_albums),
      },
      topArtists,
      topTracks,
      recentPlays,
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
