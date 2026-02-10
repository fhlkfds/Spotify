"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatTimeShort } from "@/lib/utils";

interface DiversityTrendChartProps {
  data: {
    month: string;
    genreCount: number;
    artistCount: number;
    totalMs: number;
  }[];
}

export function DiversityTrendChart({ data }: DiversityTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="month"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => {
            const [year, month] = value.split("-");
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return date.toLocaleDateString("en-US", { month: "short" });
          }}
        />
        <YAxis
          yAxisId="left"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const [year, month] = label.split("-");
              const date = new Date(parseInt(year), parseInt(month) - 1);
              const data = payload[0]?.payload;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-sm">
                  <div className="text-sm font-medium mb-2">
                    {date.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Genres:</span>
                      <span className="font-medium">{data?.genreCount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Artists:</span>
                      <span className="font-medium">{data?.artistCount}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Listening:</span>
                      <span className="font-medium">
                        {formatTimeShort(data?.totalMs || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 10 }}
          formatter={(value) => (
            <span className="text-sm text-muted-foreground">{value}</span>
          )}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="genreCount"
          name="Genres"
          stroke="#1DB954"
          strokeWidth={2}
          dot={{ fill: "#1DB954", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="artistCount"
          name="Artists"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: "#3b82f6", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
