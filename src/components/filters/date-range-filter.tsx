"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DateRangePreset =
  | "today"
  | "week"
  | "month"
  | "all";

interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: DateRangePreset;
}

interface DateRangeFilterProps {
  onChange?: (range: DateRange) => void;
  className?: string;
}

function getDateRangeFromPreset(preset: DateRangePreset): { startDate: Date; endDate: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };

    case "week":
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        startDate: weekAgo,
        endDate: now,
      };

    case "month":
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return {
        startDate: monthAgo,
        endDate: now,
      };

    case "all":
    default:
      // Return a very old date to capture all data
      return {
        startDate: new Date(2000, 0, 1),
        endDate: now,
      };
  }
}

export function DateRangeFilter({ onChange, className }: DateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [preset, setPreset] = useState<DateRangePreset>("all");

  // Initialize from URL params
  useEffect(() => {
    const urlPreset = searchParams.get("range") as DateRangePreset;

    if (urlPreset && ["today", "week", "month", "all"].includes(urlPreset)) {
      setPreset(urlPreset);
    }
  }, [searchParams]);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);

    const { startDate, endDate } = getDateRangeFromPreset(newPreset);

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", newPreset);
    params.set("startDate", startDate.toISOString());
    params.set("endDate", endDate.toISOString());
    router.push(`?${params.toString()}`, { scroll: false });

    // Call onChange callback
    onChange?.({ startDate, endDate, preset: newPreset });
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        variant={preset === "today" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetChange("today")}
        className={preset === "today" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
      >
        Today
      </Button>
      <Button
        variant={preset === "week" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetChange("week")}
        className={preset === "week" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
      >
        Week
      </Button>
      <Button
        variant={preset === "month" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetChange("month")}
        className={preset === "month" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
      >
        Month
      </Button>
      <Button
        variant={preset === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => handlePresetChange("all")}
        className={preset === "all" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
      >
        All
      </Button>
    </div>
  );
}

// Helper function to get date range from URL params
export function getDateRangeFromParams(searchParams: URLSearchParams): { startDate: Date; endDate: Date } | null {
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const preset = searchParams.get("range") as DateRangePreset;

  if (startDateStr && endDateStr) {
    return {
      startDate: new Date(startDateStr),
      endDate: new Date(endDateStr),
    };
  }

  if (preset && ["today", "week", "month", "all"].includes(preset)) {
    return getDateRangeFromPreset(preset);
  }

  // Default to all time
  return getDateRangeFromPreset("all");
}
