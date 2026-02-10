import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const dataType = searchParams.get("type") || "all"; // all, plays, artists, tracks, stats

    // Fetch all user data
    const plays = await prisma.play.findMany({
      where: { userId },
      include: {
        track: true,
        artist: true,
        album: true,
      },
      orderBy: { playedAt: "desc" },
    });

    // Calculate stats
    const totalMs = plays.reduce((sum, p) => sum + p.track.durationMs, 0);
    const uniqueArtists = new Set(plays.map((p) => p.artistId)).size;
    const uniqueTracks = new Set(plays.map((p) => p.trackId)).size;
    const uniqueAlbums = new Set(plays.map((p) => p.albumId)).size;

    // Artist stats
    const artistStats: Record<string, { name: string; playCount: number; totalMs: number }> = {};
    for (const play of plays) {
      if (!artistStats[play.artistId]) {
        artistStats[play.artistId] = { name: play.artist.name, playCount: 0, totalMs: 0 };
      }
      artistStats[play.artistId].playCount++;
      artistStats[play.artistId].totalMs += play.track.durationMs;
    }

    // Track stats
    const trackStats: Record<string, { name: string; artistName: string; playCount: number; totalMs: number }> = {};
    for (const play of plays) {
      if (!trackStats[play.trackId]) {
        trackStats[play.trackId] = {
          name: play.track.name,
          artistName: play.artist.name,
          playCount: 0,
          totalMs: 0,
        };
      }
      trackStats[play.trackId].playCount++;
      trackStats[play.trackId].totalMs += play.track.durationMs;
    }

    // Genre stats
    const genreStats: Record<string, number> = {};
    for (const play of plays) {
      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          for (const genre of genres) {
            genreStats[genre] = (genreStats[genre] || 0) + 1;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Build export data based on type
    let exportData: Record<string, unknown>;

    switch (dataType) {
      case "plays":
        exportData = {
          exportDate: new Date().toISOString(),
          totalPlays: plays.length,
          plays: plays.map((p) => ({
            playedAt: p.playedAt.toISOString(),
            trackName: p.track.name,
            artistName: p.artist.name,
            albumName: p.album.name,
            durationMs: p.track.durationMs,
          })),
        };
        break;

      case "artists":
        exportData = {
          exportDate: new Date().toISOString(),
          totalArtists: Object.keys(artistStats).length,
          artists: Object.entries(artistStats)
            .map(([id, data]) => ({
              id,
              ...data,
              totalHours: Math.round((data.totalMs / 3600000) * 100) / 100,
            }))
            .sort((a, b) => b.playCount - a.playCount),
        };
        break;

      case "tracks":
        exportData = {
          exportDate: new Date().toISOString(),
          totalTracks: Object.keys(trackStats).length,
          tracks: Object.entries(trackStats)
            .map(([id, data]) => ({
              id,
              ...data,
              totalHours: Math.round((data.totalMs / 3600000) * 100) / 100,
            }))
            .sort((a, b) => b.playCount - a.playCount),
        };
        break;

      case "stats":
        exportData = {
          exportDate: new Date().toISOString(),
          summary: {
            totalPlays: plays.length,
            totalListeningTimeMs: totalMs,
            totalListeningTimeHours: Math.round((totalMs / 3600000) * 100) / 100,
            uniqueArtists,
            uniqueTracks,
            uniqueAlbums,
            uniqueGenres: Object.keys(genreStats).length,
          },
          topArtists: Object.entries(artistStats)
            .sort((a, b) => b[1].playCount - a[1].playCount)
            .slice(0, 20)
            .map(([, data]) => data),
          topTracks: Object.entries(trackStats)
            .sort((a, b) => b[1].playCount - a[1].playCount)
            .slice(0, 20)
            .map(([, data]) => data),
          topGenres: Object.entries(genreStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([genre, count]) => ({ genre, playCount: count })),
        };
        break;

      default: // all
        exportData = {
          exportDate: new Date().toISOString(),
          user: {
            name: session.user.name,
            email: session.user.email,
          },
          summary: {
            totalPlays: plays.length,
            totalListeningTimeMs: totalMs,
            totalListeningTimeHours: Math.round((totalMs / 3600000) * 100) / 100,
            uniqueArtists,
            uniqueTracks,
            uniqueAlbums,
            uniqueGenres: Object.keys(genreStats).length,
            dateRange: {
              first: plays[plays.length - 1]?.playedAt.toISOString() || null,
              last: plays[0]?.playedAt.toISOString() || null,
            },
          },
          topArtists: Object.entries(artistStats)
            .sort((a, b) => b[1].playCount - a[1].playCount)
            .slice(0, 50)
            .map(([id, data]) => ({ id, ...data })),
          topTracks: Object.entries(trackStats)
            .sort((a, b) => b[1].playCount - a[1].playCount)
            .slice(0, 50)
            .map(([id, data]) => ({ id, ...data })),
          topGenres: Object.entries(genreStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([genre, count]) => ({ genre, playCount: count })),
          recentPlays: plays.slice(0, 100).map((p) => ({
            playedAt: p.playedAt.toISOString(),
            trackName: p.track.name,
            artistName: p.artist.name,
            albumName: p.album.name,
          })),
        };
    }

    // Format output
    if (format === "csv") {
      let csvContent = "";
      const filename = `spotify-stats-${dataType}-${new Date().toISOString().split("T")[0]}.csv`;

      if (dataType === "plays") {
        csvContent = "Played At,Track Name,Artist Name,Album Name,Duration (ms)\n";
        for (const play of plays) {
          csvContent += `"${play.playedAt.toISOString()}","${play.track.name.replace(/"/g, '""')}","${play.artist.name.replace(/"/g, '""')}","${play.album.name.replace(/"/g, '""')}",${play.track.durationMs}\n`;
        }
      } else if (dataType === "artists") {
        csvContent = "Artist Name,Play Count,Total Hours\n";
        const sortedArtists = Object.entries(artistStats).sort((a, b) => b[1].playCount - a[1].playCount);
        for (const [, data] of sortedArtists) {
          csvContent += `"${data.name.replace(/"/g, '""')}",${data.playCount},${Math.round((data.totalMs / 3600000) * 100) / 100}\n`;
        }
      } else if (dataType === "tracks") {
        csvContent = "Track Name,Artist Name,Play Count,Total Hours\n";
        const sortedTracks = Object.entries(trackStats).sort((a, b) => b[1].playCount - a[1].playCount);
        for (const [, data] of sortedTracks) {
          csvContent += `"${data.name.replace(/"/g, '""')}","${data.artistName.replace(/"/g, '""')}",${data.playCount},${Math.round((data.totalMs / 3600000) * 100) / 100}\n`;
        }
      } else {
        // Stats summary as CSV
        csvContent = "Metric,Value\n";
        csvContent += `Total Plays,${plays.length}\n`;
        csvContent += `Total Hours,${Math.round((totalMs / 3600000) * 100) / 100}\n`;
        csvContent += `Unique Artists,${uniqueArtists}\n`;
        csvContent += `Unique Tracks,${uniqueTracks}\n`;
        csvContent += `Unique Albums,${uniqueAlbums}\n`;
        csvContent += `Unique Genres,${Object.keys(genreStats).length}\n`;
      }

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "pdf") {
      // Return PDF-ready data structure
      // The actual PDF generation will be done client-side
      return NextResponse.json({
        ...exportData,
        _pdfReady: true,
      });
    }

    // Default: JSON
    const filename = `spotify-stats-${dataType}-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
