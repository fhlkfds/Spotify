import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDateRangeFromSearchParams } from "@/lib/utils";

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
    const { startDate, endDate } = getDateRangeFromSearchParams(searchParams);

    const newArtistRows = await prisma.$queryRaw<
      Array<{
        artist_id: string;
        play_count: number;
        total_ms: number;
        first_played_at: Date;
      }>
    >`
      SELECT
        p."artistId" AS artist_id,
        COUNT(*) AS play_count,
        COALESCE(SUM(t."durationMs"), 0) AS total_ms,
        MIN(p."playedAt") AS first_played_at
      FROM "Play" p
      INNER JOIN "Track" t ON t."id" = p."trackId"
      WHERE
        p."userId" = ${userId}
        AND p."playedAt" >= ${startDate}
        AND p."playedAt" <= ${endDate}
        AND NOT EXISTS (
          SELECT 1
          FROM "Play" previous
          WHERE
            previous."userId" = p."userId"
            AND previous."artistId" = p."artistId"
            AND previous."playedAt" < ${startDate}
        )
      GROUP BY p."artistId"
      ORDER BY total_ms DESC
      LIMIT 5
    `;

    const artistIds = newArtistRows.map((row) => row.artist_id);
    const artists = artistIds.length
      ? await prisma.artist.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
    const artistsById = new Map(artists.map((artist) => [artist.id, artist]));

    const newArtists = newArtistRows
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
          firstPlayedAt: new Date(row.first_played_at).toISOString(),
        };
      })
      .filter((artist): artist is NonNullable<typeof artist> => artist !== null);

    return NextResponse.json({ newArtists }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("New artists API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
