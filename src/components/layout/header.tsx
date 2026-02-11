"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/layout/search";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { navigation } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  LogOut,
  Share2,
  Menu,
  Music2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
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
    <header className="flex flex-col gap-3 border-b bg-card px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
      <div className="flex w-full items-center gap-3 sm:w-auto">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="left-0 top-0 h-full w-[85vw] max-w-xs translate-x-0 translate-y-0 rounded-none border-r p-0">
            <div className="flex h-16 items-center gap-2 border-b px-6">
              <Music2 className="h-7 w-7 text-spotify-green" />
              <span className="text-lg font-bold">Spotify Stats</span>
            </div>
            <nav className="space-y-1 p-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                <DialogClose asChild key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-spotify-green/10 text-spotify-green"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                </DialogClose>
                );
              })}
            </nav>
          </DialogContent>
        </Dialog>
        <h1 className="text-base font-semibold sm:text-lg">
          Welcome back, {session?.user?.name || "User"}
        </h1>
      </div>
      <div className="w-full sm:w-auto">
        <SearchBar />
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-4">
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
