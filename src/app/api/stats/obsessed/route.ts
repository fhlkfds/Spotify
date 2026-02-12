import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDateRangeFromSearchParams } from "@/lib/utils";

interface ObsessionPeriod {
  startDate: string;
  endDate: string;
  peakDate: string;
  playCount: number;
  totalMs: number;
  avgPlaysPerDay: number;
}

interface ObsessedTrack {
  id: string;
  name: string;
  artistName: string;
  albumImageUrl: string | null;
  obsessionPeriod: ObsessionPeriod;
  totalPlays: number;
  currentStatus: "active" | "cooling" | "past";
  intensity: number; // 1-100 score
}

interface ObsessedArtist {
  id: string;
  name: string;
  imageUrl: string | null;
  obsessionPeriod: ObsessionPeriod;
  totalPlays: number;
  topTracks: { name: string; playCount: number }[];
  currentStatus: "active" | "cooling" | "past";
  intensity: number;
}

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

    // Get all plays within range
    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        track: true,
        artist: true,
        album: true,
      },
      orderBy: { playedAt: "asc" },
    });

    if (plays.length < 50) {
      return NextResponse.json({
        obsessedTracks: [],
        obsessedArtists: [],
        currentObsessions: [],
        pastObsessions: [],
        message: "Need more listening data to detect obsessions",
      });
    }

    // Group plays by day for each track
    const trackDailyPlays: Record<string, Record<string, number>> = {};
    const trackInfo: Record<string, { name: string; artistName: string; albumImageUrl: string | null }> = {};
    const trackTotalPlays: Record<string, number> = {};
    const trackTotalMs: Record<string, number> = {};

    for (const play of plays) {
      const date = play.playedAt.toISOString().split("T")[0];

      if (!trackDailyPlays[play.trackId]) {
        trackDailyPlays[play.trackId] = {};
        trackInfo[play.trackId] = {
          name: play.track.name,
          artistName: play.artist.name,
          albumImageUrl: play.album.imageUrl,
        };
        trackTotalPlays[play.trackId] = 0;
        trackTotalMs[play.trackId] = 0;
      }

      trackDailyPlays[play.trackId][date] = (trackDailyPlays[play.trackId][date] || 0) + 1;
      trackTotalPlays[play.trackId]++;
      trackTotalMs[play.trackId] += play.track.durationMs;
    }

    // Group plays by day for each artist
    const artistDailyPlays: Record<string, Record<string, number>> = {};
    const artistInfo: Record<string, { name: string; imageUrl: string | null }> = {};
    const artistTotalPlays: Record<string, number> = {};
    const artistTotalMs: Record<string, number> = {};
    const artistTopTracks: Record<string, Record<string, number>> = {};

    for (const play of plays) {
      const date = play.playedAt.toISOString().split("T")[0];

      if (!artistDailyPlays[play.artistId]) {
        artistDailyPlays[play.artistId] = {};
        artistInfo[play.artistId] = {
          name: play.artist.name,
          imageUrl: play.artist.imageUrl,
        };
        artistTotalPlays[play.artistId] = 0;
        artistTotalMs[play.artistId] = 0;
        artistTopTracks[play.artistId] = {};
      }

      artistDailyPlays[play.artistId][date] = (artistDailyPlays[play.artistId][date] || 0) + 1;
      artistTotalPlays[play.artistId]++;
      artistTotalMs[play.artistId] += play.track.durationMs;
      artistTopTracks[play.artistId][play.track.name] = (artistTopTracks[play.artistId][play.track.name] || 0) + 1;
    }

    // Detect obsession periods for tracks
    const detectObsession = (
      dailyPlays: Record<string, number>,
      totalPlays: number
    ): ObsessionPeriod | null => {
      const dates = Object.keys(dailyPlays).sort();
      if (dates.length < 3) return null;

      // Calculate average plays per day overall
      const totalDays = dates.length;
      const avgPlaysOverall = totalPlays / totalDays;

      // Find periods where plays are significantly above average (spike detection)
      let bestPeriod: ObsessionPeriod | null = null;
      let bestScore = 0;

      // Use sliding window to find obsession periods
      const windowSizes = [7, 14, 21]; // Look for 1, 2, or 3 week obsession periods

      for (const windowSize of windowSizes) {
        for (let i = 0; i <= dates.length - windowSize; i++) {
          const windowDates = dates.slice(i, i + windowSize);
          const windowPlays = windowDates.reduce((sum, d) => sum + dailyPlays[d], 0);
          const avgPlaysInWindow = windowPlays / windowSize;

          // Check if this window represents a spike (2x or more above average)
          if (avgPlaysInWindow >= avgPlaysOverall * 2 && avgPlaysInWindow >= 2) {
            const score = avgPlaysInWindow * Math.sqrt(windowSize); // Favor longer periods

            if (score > bestScore) {
              bestScore = score;

              // Find peak day in this window
              let peakDate = windowDates[0];
              let peakPlays = dailyPlays[windowDates[0]];
              for (const d of windowDates) {
                if (dailyPlays[d] > peakPlays) {
                  peakDate = d;
                  peakPlays = dailyPlays[d];
                }
              }

              // Calculate total ms for this period
              const periodMs = windowPlays * (Object.values(dailyPlays).reduce((a, b) => a + b, 0) / totalPlays) * 180000; // Estimate based on avg track length

              bestPeriod = {
                startDate: windowDates[0],
                endDate: windowDates[windowDates.length - 1],
                peakDate,
                playCount: windowPlays,
                totalMs: periodMs,
                avgPlaysPerDay: Math.round(avgPlaysInWindow * 10) / 10,
              };
            }
          }
        }
      }

      return bestPeriod;
    };

    // Detect current status
    const getStatus = (dailyPlays: Record<string, number>): "active" | "cooling" | "past" => {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const recentDates = Object.keys(dailyPlays).filter((d) => d >= weekAgo);
      const recentPlays = recentDates.reduce((sum, d) => sum + dailyPlays[d], 0);

      if (dailyPlays[today] || dailyPlays[yesterday]) {
        return "active";
      } else if (recentPlays > 0) {
        return "cooling";
      }
      return "past";
    };

    // Calculate intensity score (0-100)
    const calculateIntensity = (
      period: ObsessionPeriod,
      totalPlays: number,
      avgPlaysOverall: number
    ): number => {
      const spikeRatio = period.avgPlaysPerDay / Math.max(avgPlaysOverall, 0.5);
      const durationDays = (new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) / 86400000 + 1;
      const durationFactor = Math.min(durationDays / 14, 1.5); // Bonus for longer obsessions

      return Math.min(Math.round(spikeRatio * 20 * durationFactor), 100);
    };

    // Process tracks
    const obsessedTracks: ObsessedTrack[] = [];
    const avgDaysActive = Object.keys(trackDailyPlays).length > 0
      ? plays.length / Object.keys(trackDailyPlays).length
      : 1;

    for (const [trackId, dailyPlays] of Object.entries(trackDailyPlays)) {
      const period = detectObsession(dailyPlays, trackTotalPlays[trackId]);
      if (period && period.playCount >= 5) {
        const status = getStatus(dailyPlays);
        const avgPlaysOverall = trackTotalPlays[trackId] / Object.keys(dailyPlays).length;
        const intensity = calculateIntensity(period, trackTotalPlays[trackId], avgPlaysOverall);

        if (intensity >= 30) {
          obsessedTracks.push({
            id: trackId,
            ...trackInfo[trackId],
            obsessionPeriod: period,
            totalPlays: trackTotalPlays[trackId],
            currentStatus: status,
            intensity,
          });
        }
      }
    }

    // Process artists
    const obsessedArtists: ObsessedArtist[] = [];

    for (const [artistId, dailyPlays] of Object.entries(artistDailyPlays)) {
      const period = detectObsession(dailyPlays, artistTotalPlays[artistId]);
      if (period && period.playCount >= 10) {
        const status = getStatus(dailyPlays);
        const avgPlaysOverall = artistTotalPlays[artistId] / Object.keys(dailyPlays).length;
        const intensity = calculateIntensity(period, artistTotalPlays[artistId], avgPlaysOverall);

        const topTracks = Object.entries(artistTopTracks[artistId])
          .map(([name, playCount]) => ({ name, playCount }))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 3);

        if (intensity >= 25) {
          obsessedArtists.push({
            id: artistId,
            ...artistInfo[artistId],
            obsessionPeriod: period,
            totalPlays: artistTotalPlays[artistId],
            topTracks,
            currentStatus: status,
            intensity,
          });
        }
      }
    }

    // Sort by intensity
    obsessedTracks.sort((a, b) => b.intensity - a.intensity);
    obsessedArtists.sort((a, b) => b.intensity - a.intensity);

    // Separate current and past obsessions
    const currentObsessions = [
      ...obsessedTracks.filter((t) => t.currentStatus === "active").slice(0, 3),
      ...obsessedArtists.filter((a) => a.currentStatus === "active").slice(0, 2),
    ];

    const pastObsessions = [
      ...obsessedTracks.filter((t) => t.currentStatus === "past").slice(0, 5),
      ...obsessedArtists.filter((a) => a.currentStatus === "past").slice(0, 3),
    ];

    return NextResponse.json({
      obsessedTracks: obsessedTracks.slice(0, 10),
      obsessedArtists: obsessedArtists.slice(0, 10),
      currentObsessions,
      pastObsessions,
      stats: {
        totalTracksAnalyzed: Object.keys(trackDailyPlays).length,
        totalArtistsAnalyzed: Object.keys(artistDailyPlays).length,
        obsessionTracksFound: obsessedTracks.length,
        obsessionArtistsFound: obsessedArtists.length,
      },
    });
  } catch (error) {
    console.error("Obsessed API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
