import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Genre mood mapping based on common genre keywords
const MOOD_KEYWORDS: Record<string, string[]> = {
  sad: ["sad", "melancholy", "heartbreak", "emo", "blues", "ballad", "grief"],
  happy: ["happy", "feel-good", "party", "dance", "upbeat", "fun", "comedy"],
  energetic: ["workout", "gym", "power", "metal", "hardcore", "punk", "edm", "drum and bass", "dubstep"],
  chill: ["chill", "ambient", "lofi", "lo-fi", "relax", "sleep", "meditation", "acoustic", "soft"],
  angry: ["angry", "rage", "aggressive", "death metal", "black metal", "grindcore"],
  romantic: ["love", "romance", "romantic", "soul", "r&b", "smooth"],
  focus: ["study", "focus", "classical", "instrumental", "piano", "minimal"],
};

function getMoodFromGenres(genres: string[]): Record<string, number> {
  const moodScores: Record<string, number> = {};

  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerGenre.includes(keyword)) {
          moodScores[mood] = (moodScores[mood] || 0) + 1;
        }
      }
    }
  }

  return moodScores;
}

interface Insight {
  id: string;
  type: "pattern" | "mood" | "anomaly" | "habit" | "discovery";
  icon: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  data?: Record<string, unknown>;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get plays from last 90 days for pattern analysis
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const plays = await prisma.play.findMany({
      where: {
        userId,
        playedAt: { gte: ninetyDaysAgo },
      },
      include: {
        track: true,
        artist: true,
      },
      orderBy: { playedAt: "asc" },
    });

    if (plays.length < 50) {
      return NextResponse.json({
        insights: [{
          id: "not-enough-data",
          type: "pattern",
          icon: "info",
          title: "More Data Needed",
          description: "Keep listening! We need more data to generate personalized insights.",
          confidence: 100,
        }],
        moodAnalysis: null,
        patterns: null,
      });
    }

    const insights: Insight[] = [];

    // Analyze day of week patterns
    const dayOfWeekGenres: Record<number, Record<string, number>> = {};
    const dayOfWeekMs: Record<number, number> = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let i = 0; i < 7; i++) {
      dayOfWeekGenres[i] = {};
      dayOfWeekMs[i] = 0;
    }

    // Analyze hour of day patterns
    const hourlyGenres: Record<number, Record<string, number>> = {};
    const hourlyMs: Record<number, number> = {};

    for (let i = 0; i < 24; i++) {
      hourlyGenres[i] = {};
      hourlyMs[i] = 0;
    }

    // Collect all genres and their play times
    const allGenres: string[] = [];
    const genreByTime: { genre: string; hour: number; day: number; ms: number }[] = [];

    for (const play of plays) {
      const hour = play.playedAt.getHours();
      const dayOfWeek = play.playedAt.getDay();

      dayOfWeekMs[dayOfWeek] += play.track.durationMs;
      hourlyMs[hour] += play.track.durationMs;

      if (play.artist.genres) {
        try {
          const genres = JSON.parse(play.artist.genres) as string[];
          allGenres.push(...genres);

          for (const genre of genres) {
            dayOfWeekGenres[dayOfWeek][genre] = (dayOfWeekGenres[dayOfWeek][genre] || 0) + play.track.durationMs;
            hourlyGenres[hour][genre] = (hourlyGenres[hour][genre] || 0) + play.track.durationMs;
            genreByTime.push({ genre, hour, day: dayOfWeek, ms: play.track.durationMs });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Find mood patterns by day of week
    for (let day = 0; day < 7; day++) {
      const dayGenres = Object.keys(dayOfWeekGenres[day]);
      if (dayGenres.length === 0) continue;

      const moodScores = getMoodFromGenres(dayGenres);
      const topMood = Object.entries(moodScores).sort((a, b) => b[1] - a[1])[0];

      if (topMood && topMood[1] >= 3) {
        const moodEmoji: Record<string, string> = {
          sad: "😢",
          happy: "😄",
          energetic: "💪",
          chill: "😌",
          angry: "😤",
          romantic: "💕",
          focus: "🎯",
        };

        insights.push({
          id: `mood-${dayNames[day].toLowerCase()}`,
          type: "mood",
          icon: moodEmoji[topMood[0]] || "🎵",
          title: `${dayNames[day]} Vibes`,
          description: `You tend to listen to ${topMood[0]} music on ${dayNames[day]}s`,
          confidence: Math.min(topMood[1] * 15, 90),
          data: { day: dayNames[day], mood: topMood[0], score: topMood[1] },
        });
      }
    }

    // Analyze time of day patterns
    const morningHours = [6, 7, 8, 9, 10, 11];
    const afternoonHours = [12, 13, 14, 15, 16, 17];
    const eveningHours = [18, 19, 20, 21, 22, 23];
    const nightHours = [0, 1, 2, 3, 4, 5];

    const getTimeSlotGenres = (hours: number[]) => {
      const genres: string[] = [];
      for (const hour of hours) {
        genres.push(...Object.keys(hourlyGenres[hour]));
      }
      return genres;
    };

    const timeSlots = [
      { name: "morning", hours: morningHours, label: "in the morning" },
      { name: "afternoon", hours: afternoonHours, label: "in the afternoon" },
      { name: "evening", hours: eveningHours, label: "in the evening" },
      { name: "night", hours: nightHours, label: "late at night" },
    ];

    for (const slot of timeSlots) {
      const genres = getTimeSlotGenres(slot.hours);
      if (genres.length < 10) continue;

      const moodScores = getMoodFromGenres(genres);
      const topMood = Object.entries(moodScores).sort((a, b) => b[1] - a[1])[0];

      if (topMood && topMood[1] >= 5) {
        insights.push({
          id: `time-${slot.name}`,
          type: "pattern",
          icon: slot.name === "morning" ? "🌅" : slot.name === "afternoon" ? "☀️" : slot.name === "evening" ? "🌆" : "🌙",
          title: `${slot.name.charAt(0).toUpperCase() + slot.name.slice(1)} Routine`,
          description: `You prefer ${topMood[0]} music ${slot.label}`,
          confidence: Math.min(topMood[1] * 10, 85),
          data: { timeSlot: slot.name, mood: topMood[0] },
        });
      }
    }

    // Detect workout patterns (energetic music during typical workout hours)
    const workoutHours = [6, 7, 8, 17, 18, 19];
    let workoutScore = 0;
    for (const hour of workoutHours) {
      const hourGenres = Object.keys(hourlyGenres[hour]);
      const moodScores = getMoodFromGenres(hourGenres);
      if (moodScores.energetic) {
        workoutScore += moodScores.energetic;
      }
    }

    if (workoutScore >= 5) {
      insights.push({
        id: "workout-pattern",
        type: "habit",
        icon: "🏋️",
        title: "Workout Warrior",
        description: "You listen to high-energy music during typical workout hours",
        confidence: Math.min(workoutScore * 12, 88),
        data: { energyScore: workoutScore },
      });
    }

    // Detect late night listening patterns
    const lateNightMs = nightHours.reduce((sum, hour) => sum + hourlyMs[hour], 0);
    const totalMs = Object.values(hourlyMs).reduce((sum, ms) => sum + ms, 0);
    const lateNightPercent = (lateNightMs / totalMs) * 100;

    if (lateNightPercent > 15) {
      const lateNightGenres = getTimeSlotGenres(nightHours);
      const moodScores = getMoodFromGenres(lateNightGenres);
      const topMood = Object.entries(moodScores).sort((a, b) => b[1] - a[1])[0];

      insights.push({
        id: "night-owl",
        type: "habit",
        icon: "🦉",
        title: "Night Owl",
        description: `${Math.round(lateNightPercent)}% of your listening happens after midnight${topMood ? `, mostly ${topMood[0]} vibes` : ""}`,
        confidence: Math.min(lateNightPercent * 3, 90),
        data: { lateNightPercent },
      });
    }

    // Detect weekend vs weekday patterns
    const weekendMs = dayOfWeekMs[0] + dayOfWeekMs[6];
    const weekdayMs = dayOfWeekMs[1] + dayOfWeekMs[2] + dayOfWeekMs[3] + dayOfWeekMs[4] + dayOfWeekMs[5];
    const weekendAvg = weekendMs / 2;
    const weekdayAvg = weekdayMs / 5;

    if (weekendAvg > weekdayAvg * 1.5) {
      insights.push({
        id: "weekend-listener",
        type: "pattern",
        icon: "🎉",
        title: "Weekend Warrior",
        description: `You listen ${Math.round((weekendAvg / weekdayAvg - 1) * 100)}% more on weekends`,
        confidence: 75,
        data: { weekendAvg, weekdayAvg },
      });
    } else if (weekdayAvg > weekendAvg * 1.3) {
      insights.push({
        id: "weekday-listener",
        type: "pattern",
        icon: "💼",
        title: "Workday Soundtrack",
        description: "You listen more during the work week than weekends",
        confidence: 70,
        data: { weekendAvg, weekdayAvg },
      });
    }

    // Anomaly detection - find unusual listening spikes
    const dailyMs: Record<string, number> = {};
    for (const play of plays) {
      const date = play.playedAt.toISOString().split("T")[0];
      dailyMs[date] = (dailyMs[date] || 0) + play.track.durationMs;
    }

    const dailyValues = Object.values(dailyMs);
    const avgDaily = dailyValues.reduce((sum, ms) => sum + ms, 0) / dailyValues.length;
    const stdDev = Math.sqrt(
      dailyValues.reduce((sum, ms) => sum + Math.pow(ms - avgDaily, 2), 0) / dailyValues.length
    );

    const anomalies = Object.entries(dailyMs)
      .filter(([, ms]) => ms > avgDaily + 2 * stdDev)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (anomalies.length > 0) {
      const topAnomaly = anomalies[0];
      const anomalyDate = new Date(topAnomaly[0]);
      const anomalyHours = Math.round(topAnomaly[1] / (1000 * 60 * 60) * 10) / 10;

      insights.push({
        id: "listening-spike",
        type: "anomaly",
        icon: "📈",
        title: "Listening Marathon",
        description: `On ${anomalyDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, you listened for ${anomalyHours} hours - way above your average!`,
        confidence: 85,
        data: { date: topAnomaly[0], ms: topAnomaly[1], avgDaily },
      });
    }

    // New discovery pattern
    const artistFirstPlay: Record<string, Date> = {};
    for (const play of plays) {
      if (!artistFirstPlay[play.artistId] || play.playedAt < artistFirstPlay[play.artistId]) {
        artistFirstPlay[play.artistId] = play.playedAt;
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDiscoveries = Object.entries(artistFirstPlay)
      .filter(([, date]) => date >= thirtyDaysAgo)
      .length;

    if (recentDiscoveries >= 5) {
      insights.push({
        id: "explorer",
        type: "discovery",
        icon: "🔍",
        title: "Music Explorer",
        description: `You discovered ${recentDiscoveries} new artists in the last 30 days`,
        confidence: 80,
        data: { newArtists: recentDiscoveries },
      });
    }

    // Overall mood analysis
    const overallMoodScores = getMoodFromGenres(allGenres);
    const sortedMoods = Object.entries(overallMoodScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const moodAnalysis = {
      primary: sortedMoods[0] ? { mood: sortedMoods[0][0], score: sortedMoods[0][1] } : null,
      secondary: sortedMoods[1] ? { mood: sortedMoods[1][0], score: sortedMoods[1][1] } : null,
      tertiary: sortedMoods[2] ? { mood: sortedMoods[2][0], score: sortedMoods[2][1] } : null,
    };

    // Sort insights by confidence
    insights.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      insights: insights.slice(0, 8),
      moodAnalysis,
      patterns: {
        peakHour: Object.entries(hourlyMs).sort((a, b) => b[1] - a[1])[0][0],
        peakDay: dayNames[parseInt(Object.entries(dayOfWeekMs).sort((a, b) => b[1] - a[1])[0][0])],
        avgDailyMinutes: Math.round(avgDaily / 60000),
        totalAnalyzedDays: Object.keys(dailyMs).length,
      },
    });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
