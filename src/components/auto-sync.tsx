"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSession } from "next-auth/react";

interface AutoSyncProps {
  intervalMinutes?: number;
  enabled?: boolean;
  onSync?: (result: { success: boolean; newPlays: number }) => void;
}

export function AutoSync({
  intervalMinutes = 15,
  enabled = true,
  onSync,
}: AutoSyncProps) {
  const { data: session } = useSession();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    localStorage.setItem("autoSyncInterval", intervalMinutes.toString());
  }, [intervalMinutes]);

  const performSync = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setLastSync(new Date());
        localStorage.setItem("lastAutoSync", new Date().toISOString());

        if (onSync) {
          onSync({ success: true, newPlays: data.newPlays || 0 });
        }

        // Only reload if there are new plays and we're on the dashboard
        if (data.newPlays > 0 && window.location.pathname === "/dashboard") {
          // Dispatch custom event instead of reloading
          window.dispatchEvent(new CustomEvent("spotify-sync-complete", {
            detail: { newPlays: data.newPlays },
          }));
        }
      }
    } catch (error) {
      console.error("Auto-sync failed:", error);
    }
  }, [session?.user?.id, onSync]);

  useEffect(() => {
    if (!enabled || !session?.user?.id) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Check if we should sync on mount (if last sync was more than interval ago)
    const lastSyncStr = localStorage.getItem("lastAutoSync");
    if (lastSyncStr) {
      const lastSyncTime = new Date(lastSyncStr);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60);

      if (diffMinutes >= intervalMinutes) {
        // Perform sync after a short delay to avoid blocking initial render
        setTimeout(performSync, 5000);
      }

      setLastSync(lastSyncTime);
    } else {
      // First time - sync after a delay
      setTimeout(performSync, 10000);
    }

    // Set up interval for future syncs
    intervalRef.current = setInterval(performSync, intervalMinutes * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, session?.user?.id, intervalMinutes, performSync]);

  // This component doesn't render anything visible
  return null;
}

// Hook for components that want to know about sync status
export function useAutoSync() {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [nextSync, setNextSync] = useState<Date | null>(null);

  useEffect(() => {
    const lastSyncStr = localStorage.getItem("lastAutoSync");
    if (lastSyncStr) {
      const lastSyncTime = new Date(lastSyncStr);
      setLastSync(lastSyncTime);

      // Calculate next sync (15 minutes after last)
      const intervalMinutes = parseInt(localStorage.getItem("autoSyncInterval") || "15");
      const nextSyncTime = new Date(lastSyncTime.getTime() + intervalMinutes * 60 * 1000);
      setNextSync(nextSyncTime);
    }

    // Listen for sync events
    const handleSyncComplete = () => {
      const now = new Date();
      setLastSync(now);

      const intervalMinutes = parseInt(localStorage.getItem("autoSyncInterval") || "15");
      setNextSync(new Date(now.getTime() + intervalMinutes * 60 * 1000));
    };

    window.addEventListener("spotify-sync-complete", handleSyncComplete);

    return () => {
      window.removeEventListener("spotify-sync-complete", handleSyncComplete);
    };
  }, []);

  return { lastSync, nextSync };
}

// Status indicator component
export function AutoSyncStatus() {
  const { lastSync, nextSync } = useAutoSync();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const savedEnabled = localStorage.getItem("autoSyncEnabled");
    setEnabled(savedEnabled !== "false");
  }, []);

  if (!enabled) {
    return (
      <span className="text-xs text-muted-foreground">Auto-sync disabled</span>
    );
  }

  if (!lastSync) {
    return (
      <span className="text-xs text-muted-foreground">Auto-sync pending...</span>
    );
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <span className="text-xs text-muted-foreground">
      Last sync: {formatTime(lastSync)}
      {nextSync && ` • Next: ${formatTime(nextSync)}`}
    </span>
  );
}
