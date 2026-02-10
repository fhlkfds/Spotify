"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatTimeShort } from "@/lib/utils";

interface GenrePieChartProps {
  data: { genre: string; totalMs: number; playCount: number }[];
}

const COLORS = [
  "#1DB954",
  "#1ed760",
  "#2ebd59",
  "#3d9140",
  "#5a8a5e",
  "#6b8e6b",
];

export function GenrePieChart({ data }: GenrePieChartProps) {
  // Take top 5 and group rest as "Other"
  const top5 = data.slice(0, 5);
  const rest = data.slice(5);

  const otherMs = rest.reduce((sum, g) => sum + g.totalMs, 0);
  const otherPlays = rest.reduce((sum, g) => sum + g.playCount, 0);

  const chartData = [
    ...top5.map((d) => ({
      name: d.genre,
      value: d.totalMs,
      playCount: d.playCount,
    })),
  ];

  if (otherMs > 0) {
    chartData.push({
      name: "Other",
      value: otherMs,
      playCount: otherPlays,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="text-sm font-medium capitalize">
                    {data.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatTimeShort(data.value)} &bull; {data.playCount} plays
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          formatter={(value) => (
            <span className="text-sm capitalize">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
