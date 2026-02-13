import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats milliseconds into a human-readable time string
 * Displays in hours format as per requirements
 */
export function formatListeningTime(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  const minutes = ms / (1000 * 60);

  if (hours >= 24) {
    const days = hours / 24;
    return `${hours.toFixed(1)} hours (${days.toFixed(1)} days)`;
  }

  if (hours >= 1) {
    return `${hours.toFixed(1)} hours`;
  }

  if (minutes >= 1) {
    return `${Math.round(minutes)} minutes`;
  }

  return "< 1 minute";
}

/**
 * Formats milliseconds to a short time format for charts/cards
 */
export function formatTimeShort(ms: number): string {
  const hours = ms / (1000 * 60 * 60);

  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }

  const minutes = ms / (1000 * 60);
  return `${Math.round(minutes)}m`;
}

/**
 * Formats a track duration (typically under 10 minutes)
 */
export function formatTrackDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Get the start of today in UTC
 */
export function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Get the start of this week (Monday)
 */
export function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get the start of this month
 */
export function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Get time ranges for filtering
 */
export function getTimeRanges() {
  return [
    { label: "Today", value: "today" as const, startDate: getStartOfToday() },
    { label: "This Week", value: "week" as const, startDate: getStartOfWeek() },
    {
      label: "This Month",
      value: "month" as const,
      startDate: getStartOfMonth(),
    },
    { label: "All Time", value: "all" as const, startDate: new Date(0) },
  ];
}

/**
 * Parse date range from URL search params
 * Supports preset ranges: today, week, month, year, all, custom
 */
export function getDateRangeFromSearchParams(searchParams: URLSearchParams): {
  startDate: Date;
  endDate: Date;
} {
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const range = searchParams.get("range");

  // If explicit dates are provided, use them
  if (startDateStr && endDateStr) {
    return {
      startDate: new Date(startDateStr),
      endDate: new Date(endDateStr),
    };
  }

  // Otherwise use preset range
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case "today": {
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    }

    case "week": {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        startDate: weekAgo,
        endDate: now,
      };
    }

    case "month": {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return {
        startDate: monthAgo,
        endDate: now,
      };
    }

    case "year": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: yearStart,
        endDate: now,
      };
    }

    case "all":
    default: {
      // Default to all time
      return {
        startDate: new Date(2000, 0, 1),
        endDate: now,
      };
    }
  }
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Format a date for relative display (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(date);
}

/**
 * Calculate listening streak (consecutive days)
 */
export function calculateStreak(dailyData: { date: string }[]): number {
  if (dailyData.length === 0) return 0;

  const sortedDates = dailyData
    .map((d) => new Date(d.date))
    .sort((a, b) => b.getTime() - a.getTime());

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff =
      (sortedDates[i - 1].getTime() - sortedDates[i].getTime()) /
      (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Generate heatmap data for the last N weeks
 */
export function generateHeatmapGrid(
  data: { date: string; count: number }[],
  weeks: number = 52
): { date: string; count: number; level: number }[] {
  const dataMap = new Map(data.map((d) => [d.date, d.count]));
  const result: { date: string; count: number; level: number }[] = [];

  const today = new Date();
  const daysToShow = weeks * 7;

  // Find max count for level calculation
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const count = dataMap.get(dateStr) || 0;

    // Calculate level (0-4) based on count relative to max
    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio > 0.75) level = 4;
      else if (ratio > 0.5) level = 3;
      else if (ratio > 0.25) level = 2;
      else level = 1;
    }

    result.push({ date: dateStr, count, level });
  }

  return result;
}
