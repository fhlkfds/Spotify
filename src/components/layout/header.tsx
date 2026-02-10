"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/layout/search";
import { RefreshCw, LogOut, Share2, Download } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Synced ${data.newPlays} new plays`);
        // Refresh the page to show new data
        if (data.newPlays > 0) {
          window.location.reload();
        }
      } else {
        setSyncResult("Sync failed");
      }
    } catch {
      setSyncResult("Sync failed");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 3000);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    setShareResult(null);
    try {
      const res = await fetch("/api/share", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await navigator.clipboard.writeText(data.shareUrl);
        setShareResult("Link copied!");
      } else {
        setShareResult("Failed to create link");
      }
    } catch {
      setShareResult("Failed to create link");
    } finally {
      setSharing(false);
      setTimeout(() => setShareResult(null), 3000);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">
          Welcome back, {session?.user?.name || "User"}
        </h1>
        <SearchBar />
      </div>
      <div className="flex items-center gap-4">
        {(syncResult || shareResult) && (
          <span className="text-sm text-muted-foreground">
            {syncResult || shareResult}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={sharing}
        >
          <Share2 className="h-4 w-4 mr-2" />
          {sharing ? "Creating..." : "Share"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
        <ThemeToggle />
        <Avatar>
          <AvatarImage src={session?.user?.image || ""} />
          <AvatarFallback>
            {session?.user?.name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <Button variant="ghost" size="icon" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
