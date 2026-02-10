"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatTimeShort } from "@/lib/utils";

interface GenreBarChartProps {
  data: { genre: string; totalMs: number; playCount: number }[];
}

export function GenreBarChart({ data }: GenreBarChartProps) {
  const chartData = data.slice(0, 10).map((d) => ({
    ...d,
    hours: d.totalMs / (1000 * 60 * 60),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
        <XAxis
          type="number"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value.toFixed(1)}h`}
        />
        <YAxis
          type="category"
          dataKey="genre"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="text-sm font-medium capitalize">
                    {data.genre}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTimeShort(data.totalMs)} &bull; {data.playCount} plays
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index === 0 ? "#1DB954" : "#1DB95480"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
