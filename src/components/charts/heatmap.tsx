"use client";

import { useMemo } from "react";
import { generateHeatmapGrid } from "@/lib/utils";

interface HeatmapProps {
  data: { date: string; count: number }[];
  weeks?: number;
}

export function Heatmap({ data, weeks = 52 }: HeatmapProps) {
  const grid = useMemo(
    () => generateHeatmapGrid(data, weeks),
    [data, weeks]
  );

  // Group by week (7 days per column)
  const columns: typeof grid[] = [];
  for (let i = 0; i < grid.length; i += 7) {
    columns.push(grid.slice(i, i + 7));
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 pr-2">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="h-3 w-6 text-xs text-muted-foreground flex items-center"
            >
              {label}
            </div>
          ))}
        </div>
        {/* Heatmap grid */}
        {columns.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`h-3 w-3 rounded-sm heatmap-${day.level}`}
                title={`${day.date}: ${day.count} plays`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-3 w-3 rounded-sm heatmap-${level}`}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
