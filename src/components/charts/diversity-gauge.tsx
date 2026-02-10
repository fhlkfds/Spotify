"use client";

import { cn } from "@/lib/utils";

interface DiversityGaugeProps {
  score: number;
  label: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function DiversityGauge({
  score,
  label,
  size = "md",
  showLabel = true,
}: DiversityGaugeProps) {
  const sizes = {
    sm: { width: 100, stroke: 8, fontSize: "text-lg" },
    md: { width: 140, stroke: 10, fontSize: "text-2xl" },
    lg: { width: 180, stroke: 12, fontSize: "text-3xl" },
  };

  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = radius * Math.PI; // Half circle
  const progress = (score / 100) * circumference;

  // Color based on score
  const getColor = (score: number) => {
    if (score >= 75) return "#1DB954"; // Spotify green
    if (score >= 50) return "#22c55e"; // Green
    if (score >= 25) return "#eab308"; // Yellow
    return "#ef4444"; // Red
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: width / 2 + 20 }}>
        <svg
          width={width}
          height={width / 2 + 20}
          viewBox={`0 0 ${width} ${width / 2 + 20}`}
          className="transform"
        >
          {/* Background arc */}
          <path
            d={`M ${stroke / 2} ${width / 2} A ${radius} ${radius} 0 0 1 ${width - stroke / 2} ${width / 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/30"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M ${stroke / 2} ${width / 2} A ${radius} ${radius} 0 0 1 ${width - stroke / 2} ${width / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Score text */}
        <div
          className={cn(
            "absolute inset-0 flex items-end justify-center pb-2",
            fontSize,
            "font-bold"
          )}
        >
          {score}%
        </div>
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground mt-1">{label}</span>
      )}
    </div>
  );
}

interface DiversityRadialProps {
  scores: {
    overall: number;
    genreDiversity: number;
    artistDiversity: number;
    explorationScore: number;
  };
}

export function DiversityRadial({ scores }: DiversityRadialProps) {
  const metrics = [
    { key: "genreDiversity", label: "Genre", color: "#1DB954" },
    { key: "artistDiversity", label: "Artist", color: "#22c55e" },
    { key: "explorationScore", label: "Exploration", color: "#3b82f6" },
  ];

  const size = 200;
  const center = size / 2;
  const maxRadius = 80;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circles */}
        {[20, 40, 60, 80].map((r) => (
          <circle
            key={r}
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-muted/20"
          />
        ))}

        {/* Axis lines */}
        {metrics.map((_, i) => {
          const angle = (i * 120 - 90) * (Math.PI / 180);
          const x = center + maxRadius * Math.cos(angle);
          const y = center + maxRadius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted/30"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={metrics
            .map((m, i) => {
              const value = scores[m.key as keyof typeof scores];
              const radius = (value / 100) * maxRadius;
              const angle = (i * 120 - 90) * (Math.PI / 180);
              const x = center + radius * Math.cos(angle);
              const y = center + radius * Math.sin(angle);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="#1DB954"
          fillOpacity={0.3}
          stroke="#1DB954"
          strokeWidth={2}
        />

        {/* Data points */}
        {metrics.map((m, i) => {
          const value = scores[m.key as keyof typeof scores];
          const radius = (value / 100) * maxRadius;
          const angle = (i * 120 - 90) * (Math.PI / 180);
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <circle
              key={m.key}
              cx={x}
              cy={y}
              r={4}
              fill="#1DB954"
              stroke="#fff"
              strokeWidth={2}
            />
          );
        })}

        {/* Labels */}
        {metrics.map((m, i) => {
          const angle = (i * 120 - 90) * (Math.PI / 180);
          const x = center + (maxRadius + 20) * Math.cos(angle);
          const y = center + (maxRadius + 20) * Math.sin(angle);
          return (
            <text
              key={m.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
            >
              {m.label}
            </text>
          );
        })}

        {/* Center score */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-bold fill-current"
        >
          {scores.overall}
        </text>
      </svg>
    </div>
  );
}
