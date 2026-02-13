"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DateRangePreset =
  | "today"
  | "week"
  | "month"
  | "year"
  | "all"
  | "custom";

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

    case "year":
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: yearStart,
        endDate: now,
      };

    case "all":
    default:
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
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const urlPreset = searchParams.get("range") as DateRangePreset;
    const urlStart = searchParams.get("startDate");
    const urlEnd = searchParams.get("endDate");

    if (urlPreset && urlPreset !== "custom") {
      setPreset(urlPreset);
      setShowCustom(false);
    } else if (urlStart && urlEnd) {
      setPreset("custom");
      setCustomStart(urlStart.split("T")[0]);
      setCustomEnd(urlEnd.split("T")[0]);
      setShowCustom(true);
    }
  }, [searchParams]);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);

    if (newPreset === "custom") {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
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

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;

    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("startDate", startDate.toISOString());
    params.set("endDate", endDate.toISOString());
    router.push(`?${params.toString()}`, { scroll: false });

    // Call onChange callback
    onChange?.({ startDate, endDate, preset: "custom" });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
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
          variant={preset === "year" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetChange("year")}
          className={preset === "year" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
        >
          This Year
        </Button>
        <Button
          variant={preset === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetChange("all")}
          className={preset === "all" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
        >
          All
        </Button>
        <Button
          variant={preset === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => handlePresetChange("custom")}
          className={preset === "custom" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Custom
        </Button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/30 rounded-lg">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-input bg-background"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-md border border-input bg-background"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="bg-spotify-green hover:bg-spotify-green/90"
          >
            Apply
          </Button>
        </div>
      )}
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

  if (preset && ["today", "week", "month", "year", "all"].includes(preset)) {
    return getDateRangeFromPreset(preset);
  }

  // Default to all time
  return getDateRangeFromPreset("all");
}
