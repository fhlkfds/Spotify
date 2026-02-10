"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface GenreEvolutionChartProps {
  data: Record<string, number | string>[];
  genres: string[];
}

// Color palette for genres
const GENRE_COLORS = [
  "#1DB954", // Spotify green
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#06b6d4",
  "#14b8a6",
  "#f43f5e",
];

export function GenreEvolutionChart({ data, genres }: GenreEvolutionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          {genres.map((genre, index) => (
            <linearGradient
              key={genre}
              id={`color-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={GENRE_COLORS[index % GENRE_COLORS.length]}
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor={GENRE_COLORS[index % GENRE_COLORS.length]}
                stopOpacity={0.1}
              />
            </linearGradient>
          ))}
        </defs>
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
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${Math.round(value)}%`}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const [year, month] = label.split("-");
              const date = new Date(parseInt(year), parseInt(month) - 1);
              return (
                <div className="rounded-lg border bg-background p-3 shadow-sm">
                  <div className="text-sm font-medium mb-2">
                    {date.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <div className="space-y-1">
                    {payload
                      .filter((p) => (p.value as number) > 0)
                      .sort((a, b) => (b.value as number) - (a.value as number))
                      .slice(0, 5)
                      .map((p) => (
                        <div
                          key={p.dataKey}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="capitalize">{p.dataKey}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {(p.value as number).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 20 }}
          formatter={(value) => (
            <span className="text-sm capitalize text-muted-foreground">
              {value}
            </span>
          )}
        />
        {genres.map((genre, index) => (
          <Area
            key={genre}
            type="monotone"
            dataKey={genre}
            stackId="1"
            stroke={GENRE_COLORS[index % GENRE_COLORS.length]}
            fill={`url(#color-${index})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface GenreRankingChartProps {
  data: { month: string; rank: number; percentage: number }[];
  genre: string;
  color?: string;
}

export function GenreRankingChart({
  data,
  genre,
  color = "#1DB954",
}: GenreRankingChartProps) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id={`rank-${genre}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" hide />
        <YAxis hide reversed domain={[1, "dataMax"]} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border bg-background p-2 shadow-sm">
                  <div className="text-sm">
                    Rank #{data.rank} ({data.percentage.toFixed(1)}%)
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="rank"
          stroke={color}
          fill={`url(#rank-${genre})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
