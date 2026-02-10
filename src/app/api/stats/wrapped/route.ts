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

    // Support different period types
    const periodType = searchParams.get("period") || "month"; // month, year, custom
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (periodType === "year") {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
      periodLabel = `${year}`;
    } else if (periodType === "month") {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 1);
      const monthName = startDate.toLocaleDateString("en-US", { month: "long" });
      periodLabel = `${monthName} ${year}`;
    } else {
      // Custom range
      const customStart = searchParams.get("start");
      const customEnd = searchParams.get("end");
      startDate = customStart ? new Date(customStart) : new Date();
      endDate = customEnd ? new Date(customEnd) : new Date();
      periodLabel = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }

    // Get all plays within the period
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        track: true,
        artist: true,
        album: true,
      },
      orderBy: { playedAt: "asc" },
    });

    if (plays.length === 0) {
      return NextResponse.json({
        period: periodLabel,
        periodType,
        hasData: false,
        stats: null,
      });
    }

    // Calculate total listening time
    const totalMs = plays.reduce((sum, p) => sum + p.track.durationMs, 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.round((totalHours / 24) * 10) / 10;

    // Top Artists
    const artistStats: Record<string, { name: string; imageUrl: string | null; playCount: number; totalMs: number }> = {};
    for (const play of plays) {
      if (!artistStats[play.artistId]) {
        artistStats[play.artistId] = {
          name: play.artist.name,
          imageUrl: play.artist.imageUrl,
          playCount: 0,
          totalMs: 0,
        };
      }
      artistStats[play.artistId].playCount++;
      artistStats[play.artistId].totalMs += play.track.durationMs;
    }
    const topArtists = Object.entries(artistStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 10);

    // Top Tracks
    const trackStats: Record<string, { name: string; artistName: string; albumImageUrl: string | null; playCount: number; totalMs: number }> = {};
    for (const play of plays) {
      if (!trackStats[play.trackId]) {
        trackStats[play.trackId] = {
          name: play.track.name,
          artistName: play.artist.name,
          albumImageUrl: play.album.imageUrl,
          playCount: 0,
          totalMs: 0,
        };
      }
      trackStats[play.trackId].playCount++;
      trackStats[play.trackId].totalMs += play.track.durationMs;
    }
    const topTracks = Object.entries(trackStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    // Top Albums
    const albumStats: Record<string, { name: string; artistName: string; imageUrl: string | null; playCount: number; totalMs: number }> = {};
    for (const play of plays) {
      if (!albumStats[play.albumId]) {
        albumStats[play.albumId] = {
          name: play.album.name,
          artistName: play.artist.name,
          imageUrl: play.album.imageUrl,
          playCount: 0,
          totalMs: 0,
        };
      }
      albumStats[play.albumId].playCount++;
      albumStats[play.albumId].totalMs += play.track.durationMs;
    }
    const topAlbums = Object.entries(albumStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 5);

    // Top Genres
    const genreStats: Record<string, { playCount: number; totalMs: number }> = {};
    for (const play of plays) {
      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          for (const genre of genres) {
            if (!genreStats[genre]) {
              genreStats[genre] = { playCount: 0, totalMs: 0 };
            }
            genreStats[genre].playCount++;
            genreStats[genre].totalMs += play.track.durationMs;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
    const topGenres = Object.entries(genreStats)
      .map(([genre, data]) => ({ genre, ...data }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 10);

    // Listening patterns
    const hourlyData: Record<number, number> = {};
    const dayOfWeekData: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyData[i] = 0;
    for (let i = 0; i < 7; i++) dayOfWeekData[i] = 0;

    for (const play of plays) {
      const hour = play.playedAt.getHours();
      const dayOfWeek = play.playedAt.getDay();
      hourlyData[hour] += play.track.durationMs;
      dayOfWeekData[dayOfWeek] += play.track.durationMs;
    }

    // Find peak hour and day
    const peakHour = Object.entries(hourlyData).sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(dayOfWeekData).sort((a, b) => b[1] - a[1])[0];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Unique counts
    const uniqueArtists = new Set(plays.map(p => p.artistId)).size;
    const uniqueTracks = new Set(plays.map(p => p.trackId)).size;
    const uniqueAlbums = new Set(plays.map(p => p.albumId)).size;
    const uniqueGenres = Object.keys(genreStats).length;

    // Fun facts
    const funFacts: string[] = [];

    // Most played track streak
    if (topTracks[0]) {
      funFacts.push(`You played "${topTracks[0].name}" ${topTracks[0].playCount} times`);
    }

    // Top artist devotion
    if (topArtists[0]) {
      const topArtistPercent = Math.round((topArtists[0].totalMs / totalMs) * 100);
      funFacts.push(`${topArtistPercent}% of your listening was ${topArtists[0].name}`);
    }

    // Peak listening time
    funFacts.push(`Your peak listening hour was ${parseInt(peakHour[0])}:00`);
    funFacts.push(`${dayNames[parseInt(peakDay[0])]} was your most active day`);

    // Listening comparison
    if (totalHours >= 24) {
      funFacts.push(`You listened for ${totalDays} days worth of music`);
    } else {
      funFacts.push(`You listened for ${totalHours} hours and ${totalMinutes % 60} minutes`);
    }

    // Average per day
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgMinutesPerDay = Math.round(totalMinutes / daysInPeriod);
    funFacts.push(`That's about ${avgMinutesPerDay} minutes per day`);

    return NextResponse.json({
      period: periodLabel,
      periodType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hasData: true,
      stats: {
        totalMs,
        totalMinutes,
        totalHours,
        totalDays,
        totalPlays: plays.length,
        uniqueArtists,
        uniqueTracks,
        uniqueAlbums,
        uniqueGenres,
        avgMinutesPerDay,
        peakHour: parseInt(peakHour[0]),
        peakDay: dayNames[parseInt(peakDay[0])],
      },
      topArtists,
      topTracks,
      topAlbums,
      topGenres,
      funFacts,
      hourlyDistribution: Object.entries(hourlyData).map(([hour, ms]) => ({
        hour: parseInt(hour),
        totalMs: ms,
      })),
      dayOfWeekDistribution: Object.entries(dayOfWeekData).map(([day, ms]) => ({
        day: parseInt(day),
        dayName: dayNames[parseInt(day)],
        totalMs: ms,
      })),
    });
  } catch (error) {
    console.error("Wrapped API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
