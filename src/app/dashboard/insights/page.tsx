"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { InsightCard, MoodBadge } from "@/components/insights/insight-card";
import { StatCard } from "@/components/stats/stat-card";
import { Brain, Lightbulb, Clock, Calendar } from "lucide-react";

interface Insight {
  id: string;
  type: "pattern" | "mood" | "anomaly" | "habit" | "discovery";
  icon: string;
  title: string;
  description: string;
  confidence: number;
  data?: Record<string, unknown>;
}

interface InsightsData {
  insights: Insight[];
  moodAnalysis: {
    primary: { mood: string; score: number } | null;
    secondary: { mood: string; score: number } | null;
    tertiary: { mood: string; score: number } | null;
  } | null;
  patterns: {
    peakHour: string;
    peakDay: string;
    avgDailyMinutes: number;
    totalAnalyzedDays: number;
  } | null;
}

export default function InsightsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch(`/api/stats/insights?${searchParams}`);
        if (res.ok) {
          const insightsData = await res.json();
          setData(insightsData);
        }
      } catch (error) {
        console.error("Failed to fetch insights:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.insights.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Smart Insights</h1>
        <Card className="glass">
          <CardContent className="py-12">
            <div className="text-center">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Keep listening! We need more data to generate personalized insights.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Smart Insights</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered analysis of your listening patterns and habits
        </p>
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter />

      {/* Quick Stats */}
      {data.patterns && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Peak Hour"
            value={`${data.patterns.peakHour}:00`}
            description="When you listen most"
            icon={Clock}
          />
          <StatCard
            title="Peak Day"
            value={data.patterns.peakDay}
            description="Your most active day"
            icon={Calendar}
          />
          <StatCard
            title="Daily Average"
            value={`${data.patterns.avgDailyMinutes}m`}
            description="Minutes per day"
            icon={Lightbulb}
          />
          <StatCard
            title="Days Analyzed"
            value={data.patterns.totalAnalyzedDays.toString()}
            description="In the last 90 days"
            icon={Brain}
          />
        </div>
      )}

      {/* Mood Analysis */}
      {data.moodAnalysis && data.moodAnalysis.primary && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🎭</span>
              Your Music Personality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Based on the genres you listen to, here's your musical mood profile:
            </p>
            <div className="flex flex-wrap gap-4">
              {data.moodAnalysis.primary && (
                <MoodBadge
                  mood={data.moodAnalysis.primary.mood}
                  score={data.moodAnalysis.primary.score}
                  isPrimary
                />
              )}
              {data.moodAnalysis.secondary && (
                <MoodBadge
                  mood={data.moodAnalysis.secondary.mood}
                  score={data.moodAnalysis.secondary.score}
                />
              )}
              {data.moodAnalysis.tertiary && (
                <MoodBadge
                  mood={data.moodAnalysis.tertiary.mood}
                  score={data.moodAnalysis.tertiary.score}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Personalized Insights</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.insights.map((insight) => (
            <InsightCard
              key={insight.id}
              icon={insight.icon}
              title={insight.title}
              description={insight.description}
              confidence={insight.confidence}
              type={insight.type}
            />
          ))}
        </div>
      </div>

      {/* How It Works */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>How Insights Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-medium mb-1">Pattern Detection</h3>
              <p className="text-sm text-muted-foreground">
                We analyze when you listen to find your habits and routines
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl mb-2">🎵</div>
              <h3 className="font-medium mb-1">Genre Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Your genre preferences reveal your musical mood profile
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl mb-2">📈</div>
              <h3 className="font-medium mb-1">Anomaly Detection</h3>
              <p className="text-sm text-muted-foreground">
                We spot unusual listening patterns and marathon sessions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insight Types Legend */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Insight Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">Pattern - Listening habits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm">Mood - Genre-based moods</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">Anomaly - Unusual activity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">Habit - Regular behaviors</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-sm">Discovery - New finds</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
