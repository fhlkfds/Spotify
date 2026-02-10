"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Music,
  Users,
  BarChart3,
  ListMusic,
  CheckCircle,
  Loader2,
} from "lucide-react";

type ExportFormat = "json" | "csv" | "pdf";
type ExportType = "all" | "plays" | "artists" | "tracks" | "stats";

interface ExportOption {
  type: ExportType;
  label: string;
  description: string;
  icon: React.ElementType;
  formats: ExportFormat[];
}

const exportOptions: ExportOption[] = [
  {
    type: "all",
    label: "Complete Export",
    description: "All your listening data, stats, and top items",
    icon: Music,
    formats: ["json", "pdf"],
  },
  {
    type: "stats",
    label: "Statistics Summary",
    description: "Your top artists, tracks, genres, and listening summary",
    icon: BarChart3,
    formats: ["json", "csv", "pdf"],
  },
  {
    type: "plays",
    label: "Play History",
    description: "Complete history of every song you've played",
    icon: ListMusic,
    formats: ["json", "csv"],
  },
  {
    type: "artists",
    label: "Artist Rankings",
    description: "All artists ranked by play count and listening time",
    icon: Users,
    formats: ["json", "csv"],
  },
  {
    type: "tracks",
    label: "Track Rankings",
    description: "All tracks ranked by play count and listening time",
    icon: Music,
    formats: ["json", "csv"],
  },
];

const formatInfo: Record<ExportFormat, { label: string; icon: React.ElementType; color: string }> = {
  json: { label: "JSON", icon: FileJson, color: "bg-yellow-500/20 text-yellow-500" },
  csv: { label: "CSV", icon: FileSpreadsheet, color: "bg-green-500/20 text-green-500" },
  pdf: { label: "PDF", icon: FileText, color: "bg-red-500/20 text-red-500" },
};

export default function ExportPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  const handleExport = async (type: ExportType, format: ExportFormat) => {
    const key = `${type}-${format}`;
    setDownloading(key);

    try {
      if (format === "pdf") {
        // For PDF, we'll generate it client-side
        const res = await fetch(`/api/export?type=${type}&format=pdf`);
        const data = await res.json();

        // Generate PDF using browser's print functionality
        await generatePDF(data, type);
      } else {
        // For JSON and CSV, download directly
        const res = await fetch(`/api/export?type=${type}&format=${format}`);
        const blob = await res.blob();

        // Get filename from Content-Disposition header
        const contentDisposition = res.headers.get("Content-Disposition");
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch?.[1] || `export.${format}`;

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setCompleted((prev) => [...prev, key]);
      setTimeout(() => {
        setCompleted((prev) => prev.filter((k) => k !== key));
      }, 3000);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setDownloading(null);
    }
  };

  const generatePDF = async (data: Record<string, unknown>, type: ExportType) => {
    // Create a printable HTML document
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const summary = data.summary as Record<string, unknown> | undefined;
    const topArtists = (data.topArtists as Array<{ name: string; playCount: number }>) || [];
    const topTracks = (data.topTracks as Array<{ name: string; artistName?: string; playCount: number }>) || [];
    const topGenres = (data.topGenres as Array<{ genre: string; playCount: number }>) || [];

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Stats Export</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              color: #333;
            }
            h1 { color: #1DB954; margin-bottom: 10px; }
            h2 { color: #333; margin-top: 30px; border-bottom: 2px solid #1DB954; padding-bottom: 10px; }
            .subtitle { color: #666; margin-bottom: 30px; }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin: 20px 0;
            }
            .stat-card {
              background: #f5f5f5;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
            }
            .stat-value { font-size: 24px; font-weight: bold; color: #1DB954; }
            .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #eee;
            }
            th { background: #f5f5f5; font-weight: 600; }
            tr:hover { background: #fafafa; }
            .rank { color: #1DB954; font-weight: bold; }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 12px;
              text-align: center;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>🎵 Spotify Stats Report</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleDateString("en-US", { dateStyle: "full" })}</p>

          ${summary ? `
          <h2>📊 Summary</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${summary.totalPlays?.toLocaleString() || 0}</div>
              <div class="stat-label">Total Plays</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.totalListeningTimeHours || 0}h</div>
              <div class="stat-label">Listening Time</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.uniqueArtists?.toLocaleString() || 0}</div>
              <div class="stat-label">Artists</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.uniqueTracks?.toLocaleString() || 0}</div>
              <div class="stat-label">Tracks</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.uniqueAlbums?.toLocaleString() || 0}</div>
              <div class="stat-label">Albums</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.uniqueGenres?.toLocaleString() || 0}</div>
              <div class="stat-label">Genres</div>
            </div>
          </div>
          ` : ""}

          ${topArtists.length > 0 ? `
          <h2>🎤 Top Artists</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Artist</th>
                <th>Plays</th>
              </tr>
            </thead>
            <tbody>
              ${topArtists.slice(0, 20).map((a, i) => `
                <tr>
                  <td class="rank">${i + 1}</td>
                  <td>${a.name}</td>
                  <td>${a.playCount}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ` : ""}

          ${topTracks.length > 0 ? `
          <h2>🎵 Top Tracks</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Track</th>
                <th>Artist</th>
                <th>Plays</th>
              </tr>
            </thead>
            <tbody>
              ${topTracks.slice(0, 20).map((t, i) => `
                <tr>
                  <td class="rank">${i + 1}</td>
                  <td>${t.name}</td>
                  <td>${t.artistName || ""}</td>
                  <td>${t.playCount}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ` : ""}

          ${topGenres.length > 0 ? `
          <h2>🎸 Top Genres</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Genre</th>
                <th>Plays</th>
              </tr>
            </thead>
            <tbody>
              ${topGenres.slice(0, 15).map((g, i) => `
                <tr>
                  <td class="rank">${i + 1}</td>
                  <td style="text-transform: capitalize">${g.genre}</td>
                  <td>${g.playCount}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ` : ""}

          <div class="footer">
            Generated by Spotify Stats Tracker • ${new Date().toISOString()}
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Export Your Data</h1>
        <p className="text-muted-foreground mt-1">
          Download your listening history and statistics in various formats
        </p>
      </div>

      {/* Format Legend */}
      <Card className="glass">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {Object.entries(formatInfo).map(([format, info]) => (
              <div key={format} className="flex items-center gap-2">
                <Badge className={info.color}>
                  <info.icon className="h-3 w-3 mr-1" />
                  {info.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format === "json" && "- Structured data, ideal for developers"}
                  {format === "csv" && "- Spreadsheet compatible (Excel, Google Sheets)"}
                  {format === "pdf" && "- Printable report format"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid gap-4 md:grid-cols-2">
        {exportOptions.map((option) => (
          <Card key={option.type} className="glass">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-spotify-green/20">
                  <option.icon className="h-5 w-5 text-spotify-green" />
                </div>
                <div>
                  <CardTitle className="text-lg">{option.label}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {option.formats.map((format) => {
                  const key = `${option.type}-${format}`;
                  const isDownloading = downloading === key;
                  const isCompleted = completed.includes(key);
                  const info = formatInfo[format];

                  return (
                    <Button
                      key={format}
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(option.type, format)}
                      disabled={isDownloading}
                      className={isCompleted ? "border-green-500 text-green-500" : ""}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      ) : (
                        <info.icon className="h-4 w-4 mr-2" />
                      )}
                      {isCompleted ? "Downloaded!" : `Export ${info.label}`}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Export All */}
      <Card className="glass border-spotify-green/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-spotify-green" />
            Quick Export
          </CardTitle>
          <CardDescription>
            Download everything at once in your preferred format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => handleExport("all", "json")}
              disabled={downloading !== null}
              className="bg-spotify-green hover:bg-spotify-green/90"
            >
              {downloading === "all-json" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              Download Full JSON
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleExport("all", "pdf")}
              disabled={downloading !== null}
            >
              {downloading === "all-pdf" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate PDF Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>About Your Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-2">What's Included</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• All your listening history</li>
                <li>• Top artists, tracks, and genres</li>
                <li>• Listening time statistics</li>
                <li>• Play counts and rankings</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-2">Privacy</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Data is downloaded directly to your device</li>
                <li>• No data is shared with third parties</li>
                <li>• You own all your listening data</li>
                <li>• Delete anytime from settings</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
