"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  icon: string;
  title: string;
  description: string;
  confidence: number;
  type: "pattern" | "mood" | "anomaly" | "habit" | "discovery";
}

const typeStyles = {
  pattern: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  mood: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  anomaly: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
  habit: "from-green-500/20 to-green-600/10 border-green-500/30",
  discovery: "from-pink-500/20 to-pink-600/10 border-pink-500/30",
};

const typeLabels = {
  pattern: "Pattern",
  mood: "Mood",
  anomaly: "Anomaly",
  habit: "Habit",
  discovery: "Discovery",
};

export function InsightCard({
  icon,
  title,
  description,
  confidence,
  type,
}: InsightCardProps) {
  return (
    <Card
      className={cn(
        "border bg-gradient-to-br overflow-hidden transition-all hover:scale-[1.02]",
        typeStyles[type]
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{title}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                {typeLabels[type]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-spotify-green rounded-full transition-all"
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {confidence}% confident
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MoodBadgeProps {
  mood: string;
  score: number;
  isPrimary?: boolean;
}

const moodEmojis: Record<string, string> = {
  sad: "😢",
  happy: "😄",
  energetic: "💪",
  chill: "😌",
  angry: "😤",
  romantic: "💕",
  focus: "🎯",
};

const moodColors: Record<string, string> = {
  sad: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  happy: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  energetic: "bg-red-500/20 text-red-400 border-red-500/30",
  chill: "bg-green-500/20 text-green-400 border-green-500/30",
  angry: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  romantic: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  focus: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function MoodBadge({ mood, score, isPrimary = false }: MoodBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border",
        moodColors[mood] || "bg-gray-500/20 text-gray-400 border-gray-500/30",
        isPrimary && "ring-2 ring-spotify-green ring-offset-2 ring-offset-background"
      )}
    >
      <span className="text-xl">{moodEmojis[mood] || "🎵"}</span>
      <div>
        <p className="font-medium capitalize">{mood}</p>
        <p className="text-xs opacity-70">Score: {score}</p>
      </div>
    </div>
  );
}
