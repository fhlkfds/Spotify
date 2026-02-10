"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Music2 } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-spotify-green/10">
      <div className="glass rounded-2xl p-12 text-center max-w-md mx-4">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center rounded-full bg-spotify-green/10 p-4 mb-4">
            <Music2 className="h-12 w-12 text-spotify-green" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Spotify Stats</h1>
          <p className="text-muted-foreground">
            Track your listening habits with beautiful visualizations
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
            className="w-full spotify-gradient hover:opacity-90 text-white font-semibold py-6 text-lg"
          >
            Connect with Spotify
          </Button>
          <p className="text-xs text-muted-foreground">
            We only read your listening history. Your data stays private and is
            stored locally.
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="font-semibold mb-4">Features</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-spotify-green">•</span>
              Listening Time
            </div>
            <div className="flex items-center gap-2">
              <span className="text-spotify-green">•</span>
              Top Artists
            </div>
            <div className="flex items-center gap-2">
              <span className="text-spotify-green">•</span>
              Album Stats
            </div>
            <div className="flex items-center gap-2">
              <span className="text-spotify-green">•</span>
              Trends & Charts
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
