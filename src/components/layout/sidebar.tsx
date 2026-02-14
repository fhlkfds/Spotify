"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Disc3,
  TrendingUp,
  BarChart3,
  Music2,
  Settings,
  Tag,
  Sparkles,
  GitBranch,
  Gift,
  Brain,
  ListMusic,
  Flame,
  Download,
  Upload,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Insights", href: "/dashboard/insights", icon: Brain },
  { name: "Obsessed", href: "/dashboard/obsessed", icon: Flame },
  { name: "Playlists", href: "/dashboard/playlists", icon: ListMusic },
  { name: "Compare", href: "/dashboard/compare", icon: BarChart3 },
];

export const contentGroups = [
  {
    label: "Content",
    items: [
      { name: "Artists", href: "/dashboard/artists", icon: Users },
      { name: "Albums", href: "/dashboard/albums", icon: Disc3 },
      { name: "Genres", href: "/dashboard/genres", icon: Tag },
    ],
  },
  {
    label: "Analytics",
    items: [
      { name: "Diversity", href: "/dashboard/diversity", icon: Sparkles },
      { name: "Genre Evolution", href: "/dashboard/genre-evolution", icon: GitBranch },
      { name: "Trends", href: "/dashboard/trends", icon: TrendingUp },
    ],
  },
];

export const settingsGroup = {
  name: "Settings",
  href: "/dashboard/settings",
  icon: Settings,
  items: [
    { name: "Import", href: "/dashboard/import", icon: Upload },
    { name: "Wrapped", href: "/dashboard/wrapped", icon: Gift },
    { name: "Export", href: "/dashboard/export", icon: Download },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Content: true,
    Analytics: true,
    Settings: true,
  });

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <Music2 className="h-8 w-8 text-spotify-green" />
        <span className="text-xl font-bold">Spotify Stats</span>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {/* Main Navigation */}
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
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
          );
        })}

        {/* Content Groups */}
        {contentGroups.map((group) => (
          <div key={group.label} className="mt-6">
            <button
              onClick={() => toggleSection(group.label)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span>{group.label}</span>
              {openSections[group.label] ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {openSections[group.label] && (
              <div className="space-y-1 mt-2">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
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
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Settings Group */}
        <div className="mt-6 border-t pt-4">
          <button
            onClick={() => toggleSection("Settings")}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-3">
              <settingsGroup.icon className="h-5 w-5" />
              <span>{settingsGroup.name}</span>
            </div>
            {openSections["Settings"] ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {openSections["Settings"] && (
            <div className="mt-1 ml-6 space-y-1">
              {settingsGroup.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-spotify-green/10 text-spotify-green"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
