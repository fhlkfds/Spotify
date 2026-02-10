import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const userId = session.user.id;

  // Search across artists, tracks, albums, and genres
  const [artists, tracks, albums] = await Promise.all([
    // Search artists
    prisma.artist.findMany({
      where: {
        AND: [
          { name: { contains: query } },
          { plays: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        genres: true,
        _count: { select: { plays: { where: { userId } } } },
      },
      take: 5,
    }),

    // Search tracks
    prisma.track.findMany({
      where: {
        AND: [
          { name: { contains: query } },
          { plays: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        artist: { select: { name: true } },
        album: { select: { imageUrl: true } },
        _count: { select: { plays: { where: { userId } } } },
      },
      take: 5,
    }),

    // Search albums
    prisma.album.findMany({
      where: {
        AND: [
          { name: { contains: query } },
          { plays: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        artist: { select: { name: true } },
        _count: { select: { plays: { where: { userId } } } },
      },
      take: 5,
    }),
  ]);

  // Search genres from artist genres field
  const artistsWithGenres = await prisma.artist.findMany({
    where: {
      AND: [
        { genres: { contains: query } },
        { plays: { some: { userId } } },
      ],
    },
    select: {
      genres: true,
    },
    take: 20,
  });

  // Extract matching genres
  const genreSet = new Set<string>();
  artistsWithGenres.forEach((artist) => {
    if (artist.genres) {
      try {
        const genreList = JSON.parse(artist.genres) as string[];
        genreList.forEach((genre) => {
          if (genre.toLowerCase().includes(query)) {
            genreSet.add(genre);
          }
        });
      } catch {
        // Skip if genres is not valid JSON
      }
    }
  });

  const genres = Array.from(genreSet).slice(0, 5);

  return NextResponse.json({
    results: {
      artists: artists.map((a) => ({
        id: a.id,
        name: a.name,
        imageUrl: a.imageUrl,
        playCount: a._count.plays,
        type: "artist" as const,
      })),
      tracks: tracks.map((t) => ({
        id: t.id,
        name: t.name,
        artistName: t.artist.name,
        imageUrl: t.album.imageUrl,
        playCount: t._count.plays,
        type: "track" as const,
      })),
      albums: albums.map((a) => ({
        id: a.id,
        name: a.name,
        artistName: a.artist.name,
        imageUrl: a.imageUrl,
        playCount: a._count.plays,
        type: "album" as const,
      })),
      genres: genres.map((g) => ({
        name: g,
        type: "genre" as const,
      })),
    },
  });
}
