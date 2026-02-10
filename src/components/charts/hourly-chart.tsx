"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatTimeShort } from "@/lib/utils";

interface HourlyChartProps {
  data: { hour: number; totalMs: number; playCount: number }[];
}

export function HourlyChart({ data }: HourlyChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    hours: d.totalMs / (1000 * 60 * 60),
    label: `${d.hour.toString().padStart(2, "0")}:00`,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis
          dataKey="label"
          stroke="#888888"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          interval={2}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(1)}h`}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="text-sm font-medium">{data.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatTimeShort(data.totalMs)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.playCount} plays
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="hours" fill="#1DB954" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
