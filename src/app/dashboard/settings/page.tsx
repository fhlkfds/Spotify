"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileJson,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Music,
  Users,
  BarChart3,
  ListMusic,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Image,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  failed: number;
  skipped: number;
  errors: string[];
  message: string;
}

interface FileStatus {
  file: File;
  status: "pending" | "importing" | "success" | "error";
  result?: ImportResult;
  error?: string;
  isChunk?: boolean;
  chunkInfo?: string;
  showErrors?: boolean;
}

// Maximum entries per chunk to avoid timeouts (500 = ~30-60 sec processing time)
// Reduced to stay well under Cloudflare's 100-second timeout
const MAX_ENTRIES_PER_CHUNK = 500;

export default function SettingsPage() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importMode, setImportMode] = useState<"batch" | "individual">("batch");
  const [overallResult, setOverallResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showChunkNotice, setShowChunkNotice] = useState(false);
  const [localFiles, setLocalFiles] = useState<{ name: string; size: number; modified: string }[]>([]);
  const [isLoadingLocalFiles, setIsLoadingLocalFiles] = useState(false);
  const [isImportingLocal, setIsImportingLocal] = useState(false);
  const [localImportResult, setLocalImportResult] = useState<ImportResult | null>(null);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [fetchImagesResult, setFetchImagesResult] = useState<{
    artistsUpdated: number;
    albumsUpdated: number;
    failed: number;
  } | null>(null);
  const [missingImagesCount, setMissingImagesCount] = useState<{ artists: number; albums: number } | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [deduplicateResult, setDeduplicateResult] = useState<{
    artistsMerged: number;
    albumsMerged: number;
  } | null>(null);
  const [duplicatesCount, setDuplicatesCount] = useState<{ duplicateArtists: number; duplicateAlbums: number } | null>(null);

  // Export state
  type ExportFormat = "json" | "csv" | "pdf";
  type ExportType = "all" | "plays" | "artists" | "tracks" | "stats";
  const [downloading, setDownloading] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  // Process and potentially split files
  const processFiles = useCallback(async (rawFiles: File[]): Promise<FileStatus[]> => {
    const processedFiles: FileStatus[] = [];

    for (const file of rawFiles) {
      if (!file.name.endsWith(".json")) {
        continue;
      }

      try {
        // Read and parse the JSON file
        const content = await file.text();
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          processedFiles.push({
            file,
            status: "pending" as const,
          });
          continue;
        }

        const entryCount = data.length;

        // If file is small enough, add as-is
        if (entryCount <= MAX_ENTRIES_PER_CHUNK) {
          processedFiles.push({
            file,
            status: "pending" as const,
          });
          continue;
        }

        // File is too large, split it into chunks
        const numChunks = Math.ceil(entryCount / MAX_ENTRIES_PER_CHUNK);
        console.log(`Splitting ${file.name} (${entryCount} entries) into ${numChunks} chunks`);

        for (let i = 0; i < numChunks; i++) {
          const start = i * MAX_ENTRIES_PER_CHUNK;
          const end = Math.min(start + MAX_ENTRIES_PER_CHUNK, entryCount);
          const chunk = data.slice(start, end);

          // Create a new File object for the chunk
          const chunkBlob = new Blob([JSON.stringify(chunk)], { type: "application/json" });
          const chunkFile = new File(
            [chunkBlob],
            `${file.name.replace('.json', '')}_chunk_${i + 1}_of_${numChunks}.json`,
            { type: "application/json" }
          );

          processedFiles.push({
            file: chunkFile,
            status: "pending" as const,
            isChunk: true,
            chunkInfo: `Part ${i + 1}/${numChunks} (${chunk.length} entries)`,
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        // If parsing fails, add the file anyway (API will handle the error)
        processedFiles.push({
          file,
          status: "pending" as const,
        });
      }
    }

    return processedFiles;
  }, []);

  // Import a single file
  const importSingleFile = useCallback(async (fileStatus: FileStatus) => {
    // Update status to importing
    setFiles((prev) =>
      prev.map((f) => (f.file === fileStatus.file ? { ...f, status: "importing" as const } : f))
    );

    try {
      const formData = new FormData();
      formData.append("files", fileStatus.file);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        console.error("Response status:", response.status);
        const text = await response.text().catch(() => "Unable to read response");
        console.error("Response preview:", text.substring(0, 500));
        throw new Error(`Server returned invalid response (${response.status}). Check console for details.`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Import failed with status ${response.status}`);
      }

      // Update status to success
      setFiles((prev) =>
        prev.map((f) =>
          f.file === fileStatus.file
            ? { ...f, status: "success" as const, result: data }
            : f
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Import failed";

      // Update status to error
      setFiles((prev) =>
        prev.map((f) =>
          f.file === fileStatus.file
            ? { ...f, status: "error" as const, error: errorMessage }
            : f
        )
      );
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.name.endsWith(".json")
      );

      if (droppedFiles.length > 0) {
        setIsProcessingFiles(true);
        setOverallResult(null);
        setError(null);

        // Process files (auto-split if needed)
        const newFileStatuses = await processFiles(droppedFiles);

        // If any files were split, automatically switch to individual mode
        const hasChunks = newFileStatuses.some((f) => f.isChunk);
        if (hasChunks) {
          if (importMode === "batch") {
            setImportMode("individual");
          }
          setShowChunkNotice(true);
          setTimeout(() => setShowChunkNotice(false), 10000); // Hide after 10 seconds
          console.log("Files were split into chunks and will be imported one by one");
        }

        setFiles((prev) => [...prev, ...newFileStatuses]);
        setIsProcessingFiles(false);

        // If individual mode, import each file immediately
        if (importMode === "individual" || hasChunks) {
          for (const fileStatus of newFileStatuses) {
            await importSingleFile(fileStatus);
          }
        }
      }
    },
    [importMode, importSingleFile, processFiles]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []).filter((file) =>
        file.name.endsWith(".json")
      );

      if (selectedFiles.length > 0) {
        setIsProcessingFiles(true);
        setOverallResult(null);
        setError(null);

        // Process files (auto-split if needed)
        const newFileStatuses = await processFiles(selectedFiles);

        // If any files were split, automatically switch to individual mode
        const hasChunks = newFileStatuses.some((f) => f.isChunk);
        if (hasChunks) {
          if (importMode === "batch") {
            setImportMode("individual");
          }
          setShowChunkNotice(true);
          setTimeout(() => setShowChunkNotice(false), 10000); // Hide after 10 seconds
          console.log("Files were split into chunks and will be imported one by one");
        }

        setFiles((prev) => [...prev, ...newFileStatuses]);
        setIsProcessingFiles(false);

        // If individual mode, import each file immediately
        if (importMode === "individual" || hasChunks) {
          for (const fileStatus of newFileStatuses) {
            await importSingleFile(fileStatus);
          }
        }
      }

      // Reset input
      e.target.value = "";
    },
    [importMode, importSingleFile, processFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles((prev) => prev.filter((f) => f.status !== "success"));
  }, []);

  const retryFailed = useCallback(async () => {
    const failedFiles = files.filter((f) => f.status === "error");
    for (const fileStatus of failedFiles) {
      await importSingleFile(fileStatus);
    }
  }, [files, importSingleFile]);

  const toggleErrors = useCallback((index: number) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, showErrors: !f.showErrors } : f
      )
    );
  }, []);

  // Load local files from import folder
  const loadLocalFiles = useCallback(async () => {
    setIsLoadingLocalFiles(true);
    try {
      const response = await fetch("/api/import/local");
      const data = await response.json();
      setLocalFiles(data.files || []);
    } catch (error) {
      console.error("Failed to load local files:", error);
      setLocalFiles([]);
    } finally {
      setIsLoadingLocalFiles(false);
    }
  }, []);

  // Import from local folder (batched to avoid timeouts)
  const handleLocalImport = useCallback(async () => {
    setIsImportingLocal(true);
    setLocalImportResult(null);

    let skip = 0;
    let totalImported = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];
    let batchNumber = 1;

    try {
      // Keep calling the API until all entries are processed
      while (true) {
        console.log(`Processing batch ${batchNumber} (starting from entry ${skip})...`);

        const response = await fetch(`/api/import/local?skip=${skip}`, {
          method: "POST",
        });

        // Get the response text first so we can debug if JSON parsing fails
        const responseText = await response.text();

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Failed to parse local import response as JSON:", parseError);
          console.error("Response status:", response.status);
          console.error("Response preview:", responseText.substring(0, 500));
          throw new Error(`Server returned invalid response (${response.status}). Check console for details.`);
        }

        if (!response.ok) {
          throw new Error(data.error || "Local import failed");
        }

        // Accumulate results
        totalImported += data.imported;
        totalDuplicates += data.duplicates;
        totalFailed += data.failed;
        totalSkipped += data.skipped;
        allErrors.push(...(data.errors || []));

        // Check if there are more entries to process
        const hasMore = data.errors && data.errors.length > 0 &&
          data.errors[0].includes("More entries available");

        if (!hasMore) {
          // All done!
          console.log("Import complete!");
          break;
        }

        // Update skip count for next batch (500 entries per batch)
        skip += 500;
        batchNumber++;

        // Show progress
        setLocalImportResult({
          success: true,
          imported: totalImported,
          duplicates: totalDuplicates,
          failed: totalFailed,
          skipped: totalSkipped,
          errors: [`Processing batch ${batchNumber}...`, ...allErrors.slice(0, 10)],
          message: `Processing batch ${batchNumber}...`,
        });
      }

      // Final result
      setLocalImportResult({
        success: true,
        imported: totalImported,
        duplicates: totalDuplicates,
        failed: totalFailed,
        skipped: totalSkipped,
        errors: allErrors.slice(0, 100),
        message: `Complete: ${totalImported} imported, ${totalDuplicates} duplicates`,
      });

      // Refresh the file list
      await loadLocalFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local import failed";
      setLocalImportResult({
        success: false,
        imported: totalImported,
        duplicates: totalDuplicates,
        failed: totalFailed,
        skipped: totalSkipped,
        errors: [message, ...allErrors],
        message,
      });
    } finally {
      setIsImportingLocal(false);
    }
  }, [loadLocalFiles]);

  // Fetch missing images
  const checkMissingImages = useCallback(async () => {
    try {
      const response = await fetch("/api/fetch-images");
      if (response.ok) {
        const count = await response.json();
        setMissingImagesCount(count);
      }
    } catch (error) {
      console.error("Failed to check missing images:", error);
    }
  }, []);

  const handleFetchImages = useCallback(async () => {
    setIsFetchingImages(true);
    setFetchImagesResult(null);

    try {
      const response = await fetch("/api/fetch-images?limit=100", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch images");
      }

      setFetchImagesResult(data);
      // Refresh the missing images count
      await checkMissingImages();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch images";
      console.error(message);
    } finally {
      setIsFetchingImages(false);
    }
  }, [checkMissingImages]);

  // Deduplicate artists and albums
  const checkDuplicates = useCallback(async () => {
    try {
      const response = await fetch("/api/deduplicate");
      if (response.ok) {
        const count = await response.json();
        setDuplicatesCount(count);
      }
    } catch (error) {
      console.error("Failed to check duplicates:", error);
    }
  }, []);

  const handleDeduplicate = useCallback(async () => {
    setIsDeduplicating(true);
    setDeduplicateResult(null);

    try {
      const response = await fetch("/api/deduplicate", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deduplicate");
      }

      setDeduplicateResult(data);
      // Refresh the duplicates count
      await checkDuplicates();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deduplicate";
      console.error(message);
    } finally {
      setIsDeduplicating(false);
    }
  }, [checkDuplicates]);

  // Export handlers
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

  // Batch import all pending files
  const handleBatchImport = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    setOverallResult(null);
    setError(null);

    try {
      const formData = new FormData();
      pendingFiles.forEach((fileStatus) => formData.append("files", fileStatus.file));

      // Simulate progress (actual progress would require streaming)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        console.error("Response status:", response.status);
        const text = await response.text().catch(() => "Unable to read response");
        console.error("Response preview:", text.substring(0, 500));
        throw new Error(`Server returned invalid response (${response.status}). Are you logged in? Check console for details.`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Import failed with status ${response.status}`);
      }

      // Update all pending files to success
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "pending" ? { ...f, status: "success" as const, result: data } : f
        )
      );

      setOverallResult(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Import failed";
      setError(errorMessage);

      // Update all pending files to error
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "pending" ? { ...f, status: "error" as const, error: errorMessage } : f
        )
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and import/export listening history
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import">Import/Export</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="wrapped">Wrapped</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* Local Import Section */}
          <Card className="glass border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-500" />
            Local Import (No Spotify API)
          </CardTitle>
          <CardDescription>
            Import JSON files from the server&apos;s import folder - No API calls, no rate limits!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-500/10 p-4 space-y-3">
            <h4 className="font-medium text-blue-400">How it works:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Place your Spotify JSON files in the <code className="bg-background px-1 rounded">import/</code> folder on the server</li>
              <li>Click "Scan for Files" to see available files</li>
              <li>Click "Import All Files" to process them</li>
              <li>No Spotify API calls = No rate limiting = Much faster!</li>
            </ol>
            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
              ⚠️ <strong>Note:</strong> Only works with Extended History (endsong_*.json) files that contain track IDs. StreamingHistory files will be skipped.
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={loadLocalFiles}
              disabled={isLoadingLocalFiles || isImportingLocal}
              variant="outline"
            >
              {isLoadingLocalFiles ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              Scan for Files
            </Button>

            {localFiles.length > 0 && (
              <Button
                onClick={handleLocalImport}
                disabled={isImportingLocal}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {isImportingLocal ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import All Files ({localFiles.length})
              </Button>
            )}
          </div>

          {localFiles.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-sm mb-2">Files in import folder:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {localFiles.map((file, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{file.name}</span>
                    <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {localImportResult && (
            <Alert className={localImportResult.success ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}>
              {localImportResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertTitle className={localImportResult.success ? "text-green-500" : "text-red-500"}>
                {localImportResult.success ? "Import Complete" : "Import Failed"}
              </AlertTitle>
              <AlertDescription className={localImportResult.success ? "text-green-400/80" : "text-red-400/80"}>
                <ul className="mt-2 space-y-1">
                  <li>Imported: {localImportResult.imported.toLocaleString()} plays</li>
                  <li>Duplicates skipped: {localImportResult.duplicates.toLocaleString()}</li>
                  <li>Failed: {localImportResult.failed.toLocaleString()}</li>
                  <li>Skipped (no track ID): {localImportResult.skipped.toLocaleString()}</li>
                </ul>
                {localImportResult.errors.length > 0 && (
                  <div className="mt-2 text-xs">
                    <strong>Errors:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {localImportResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Deduplicate Artists/Albums Section */}
      <Card className="glass border-orange-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Deduplicate Artists &amp; Albums
          </CardTitle>
          <CardDescription>
            Merge duplicate artists and albums that have the same name
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-orange-500/10 p-4 space-y-3">
            <h4 className="font-medium text-orange-400">Why do I have duplicates?</h4>
            <p className="text-sm text-muted-foreground">
              Older imports created separate entries for each track. This tool merges all
              artists/albums with the same name into a single entry.
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              onClick={checkDuplicates}
              disabled={isDeduplicating}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check for Duplicates
            </Button>

            {duplicatesCount && (
              <div className="text-sm text-muted-foreground">
                {duplicatesCount.duplicateArtists} duplicate artists, {duplicatesCount.duplicateAlbums} duplicate albums
              </div>
            )}
          </div>

          {duplicatesCount && (duplicatesCount.duplicateArtists > 0 || duplicatesCount.duplicateAlbums > 0) && (
            <Button
              onClick={handleDeduplicate}
              disabled={isDeduplicating}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isDeduplicating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deduplicating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Merge Duplicates
                </>
              )}
            </Button>
          )}

          {deduplicateResult && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Deduplication Complete</AlertTitle>
              <AlertDescription className="text-green-400/80">
                <ul className="mt-2 space-y-1">
                  <li>Artists merged: {deduplicateResult.artistsMerged}</li>
                  <li>Albums merged: {deduplicateResult.albumsMerged}</li>
                </ul>
                <div className="mt-2 text-xs">
                  ✅ Your library is now clean! Future imports will not create duplicates.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Fetch Missing Images Section */}
      <Card className="glass border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-purple-500" />
            Fetch Missing Images
          </CardTitle>
          <CardDescription>
            After local import, fetch artist and album images from Spotify API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-purple-500/10 p-4 space-y-3">
            <h4 className="font-medium text-purple-400">Why do I need this?</h4>
            <p className="text-sm text-muted-foreground">
              Local imports don&apos;t fetch images to avoid rate limits and be faster.
              Use this tool to fetch missing artist and album artwork from Spotify.
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              onClick={checkMissingImages}
              disabled={isFetchingImages}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Missing Images
            </Button>

            {missingImagesCount && (
              <div className="text-sm text-muted-foreground">
                {missingImagesCount.artists} artists, {missingImagesCount.albums} albums without images
              </div>
            )}
          </div>

          {missingImagesCount && (missingImagesCount.artists > 0 || missingImagesCount.albums > 0) && (
            <Button
              onClick={handleFetchImages}
              disabled={isFetchingImages}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {isFetchingImages ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching Images...
                </>
              ) : (
                <>
                  <Image className="h-4 w-4 mr-2" />
                  Fetch Images (100 items)
                </>
              )}
            </Button>
          )}

          {fetchImagesResult && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Images Fetched</AlertTitle>
              <AlertDescription className="text-green-400/80">
                <ul className="mt-2 space-y-1">
                  <li>Artists updated: {fetchImagesResult.artistsUpdated}</li>
                  <li>Albums updated: {fetchImagesResult.albumsUpdated}</li>
                  {fetchImagesResult.failed > 0 && (
                    <li className="text-yellow-400">Failed: {fetchImagesResult.failed}</li>
                  )}
                </ul>
                {(fetchImagesResult.artistsUpdated + fetchImagesResult.albumsUpdated) >= 100 && (
                  <div className="mt-2 text-xs">
                    💡 Click &quot;Fetch Images&quot; again to process more items.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Import Spotify History</CardTitle>
          <CardDescription>
            Import your historical listening data from Spotify&apos;s data export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Chunk Notice */}
          {showChunkNotice && (
            <Alert className="border-blue-500/50 bg-blue-500/10">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle className="text-blue-500">Files Auto-Split</AlertTitle>
              <AlertDescription className="text-blue-400/80">
                Your large file was automatically split into smaller chunks and will be imported one by one to prevent timeouts. Each chunk will import separately and you&apos;ll see progress for each.
              </AlertDescription>
            </Alert>
          )}

          {/* Import Mode Selector */}
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
            <span className="text-sm font-medium">Import Mode:</span>
            <div className="flex gap-2">
              <Button
                variant={importMode === "batch" ? "default" : "outline"}
                size="sm"
                onClick={() => setImportMode("batch")}
                disabled={isImporting}
                className={importMode === "batch" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
              >
                Batch Import
              </Button>
              <Button
                variant={importMode === "individual" ? "default" : "outline"}
                size="sm"
                onClick={() => setImportMode("individual")}
                disabled={isImporting}
                className={importMode === "individual" ? "bg-spotify-green hover:bg-spotify-green/90" : ""}
              >
                Import One by One
              </Button>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {importMode === "batch"
                ? "Add multiple files, then import all at once"
                : "Each file imports immediately when added"}
            </span>
          </div>

          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <h4 className="font-medium">How to get your data:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Go to{" "}
                <a
                  href="https://www.spotify.com/account/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-spotify-green hover:underline inline-flex items-center gap-1"
                >
                  Spotify Privacy Settings
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Scroll down to &quot;Download your data&quot;</li>
              <li>
                Request either:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>
                    <strong>Account data</strong> - Last year of history (available in ~5 days)
                  </li>
                  <li>
                    <strong>Extended streaming history</strong> - Complete history (available in ~30 days)
                  </li>
                </ul>
              </li>
              <li>Download the ZIP file when ready and extract the JSON files</li>
              <li>
                Upload the <code className="bg-background px-1 rounded">StreamingHistory_music_*.json</code> or{" "}
                <code className="bg-background px-1 rounded">endsong_*.json</code> files below
              </li>
            </ol>
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-400">
              ℹ️ <strong>Auto-split:</strong> Files with more than {MAX_ENTRIES_PER_CHUNK.toLocaleString()} entries are automatically split into smaller chunks to prevent timeouts. Each chunk is imported separately.
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragging
                ? "border-spotify-green bg-spotify-green/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              (isImporting || isProcessingFiles) && "opacity-50 pointer-events-none"
            )}
          >
            {isProcessingFiles ? (
              <>
                <Loader2 className="h-10 w-10 mx-auto text-spotify-green mb-4 animate-spin" />
                <p className="text-muted-foreground mb-2">
                  Processing files and checking if splitting is needed...
                </p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Drag and drop JSON files here, or
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isImporting || isProcessingFiles}
                  />
                  <span className="text-spotify-green hover:underline">browse files</span>
                </label>
                <p className="text-xs text-muted-foreground mt-3">
                  Files with &gt;{MAX_ENTRIES_PER_CHUNK.toLocaleString()} entries will be automatically split
                </p>
              </>
            )}
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                {importMode === "batch" ? "Selected files:" : "Files:"}
              </h4>
              <div className="space-y-2">
                {files.map((fileStatus, index) => (
                  <div
                    key={`${fileStatus.file.name}-${index}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg p-3 transition-colors",
                      fileStatus.status === "success" && "bg-green-500/10 border border-green-500/30",
                      fileStatus.status === "error" && "bg-red-500/10 border border-red-500/30",
                      fileStatus.status === "importing" && "bg-blue-500/10 border border-blue-500/30",
                      fileStatus.status === "pending" && "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {fileStatus.status === "pending" && (
                        <FileJson className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      {fileStatus.status === "importing" && (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                      )}
                      {fileStatus.status === "success" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      {fileStatus.status === "error" && (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm truncate">{fileStatus.file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                          {fileStatus.isChunk && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded flex-shrink-0">
                              Auto-split
                            </span>
                          )}
                        </div>

                        {fileStatus.chunkInfo && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {fileStatus.chunkInfo}
                          </div>
                        )}

                        {fileStatus.status === "success" && fileStatus.result && (
                          <div className="text-xs mt-1 space-y-1">
                            {fileStatus.result.imported > 0 ? (
                              <div className="text-green-400/80">
                                ✓ Imported: {fileStatus.result.imported.toLocaleString()} plays
                                {fileStatus.result.duplicates > 0 &&
                                  ` (${fileStatus.result.duplicates} duplicates)`}
                              </div>
                            ) : (
                              <div className="text-yellow-400">
                                ⚠️ 0 tracks imported
                              </div>
                            )}
                            {fileStatus.result.failed > 0 && (
                              <div className="text-red-400">
                                ✗ Failed: {fileStatus.result.failed.toLocaleString()} tracks
                              </div>
                            )}
                          </div>
                        )}

                        {fileStatus.status === "error" && fileStatus.error && (
                          <div className="text-xs text-red-400 mt-1">{fileStatus.error}</div>
                        )}

                        {fileStatus.status === "importing" && (
                          <div className="text-xs text-blue-400 mt-1">Importing...</div>
                        )}

                        {/* Show errors button if there are errors and 0 imports */}
                        {fileStatus.status === "success" &&
                          fileStatus.result &&
                          fileStatus.result.errors.length > 0 &&
                          fileStatus.result.imported === 0 && (
                            <button
                              onClick={() => toggleErrors(index)}
                              className="text-xs text-yellow-400 hover:text-yellow-300 mt-1 flex items-center gap-1"
                            >
                              {fileStatus.showErrors ? "▼" : "▶"} Show why ({fileStatus.result.errors.length} errors)
                            </button>
                          )}

                        {/* Show errors for any successful import with failures */}
                        {fileStatus.status === "success" &&
                          fileStatus.result &&
                          fileStatus.result.errors.length > 0 &&
                          fileStatus.result.imported > 0 && (
                            <button
                              onClick={() => toggleErrors(index)}
                              className="text-xs text-orange-400 hover:text-orange-300 mt-1 flex items-center gap-1"
                            >
                              {fileStatus.showErrors ? "▼" : "▶"} Show errors ({fileStatus.result.errors.length})
                            </button>
                          )}

                        {/* Expanded error details */}
                        {fileStatus.showErrors &&
                          fileStatus.result &&
                          fileStatus.result.errors.length > 0 && (
                            <div className="mt-2 p-2 bg-background/50 rounded text-xs space-y-1 max-h-40 overflow-y-auto">
                              <div className="font-medium text-yellow-400 mb-1">
                                {fileStatus.result.imported === 0
                                  ? "Why nothing was imported:"
                                  : "Errors encountered:"}
                              </div>
                              {fileStatus.result.errors.slice(0, 10).map((err, i) => (
                                <div key={i} className="text-muted-foreground">
                                  • {err}
                                </div>
                              ))}
                              {fileStatus.result.errors.length > 10 && (
                                <div className="text-muted-foreground/50 italic">
                                  ...and {fileStatus.result.errors.length - 10} more errors
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    {fileStatus.status !== "importing" && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                        disabled={isImporting}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons for File Management */}
              <div className="flex gap-2 mt-2">
                {files.filter((f) => f.status === "success").length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCompleted}
                    disabled={isImporting}
                  >
                    Clear Completed
                  </Button>
                )}
                {files.filter((f) => f.status === "error").length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryFailed}
                    disabled={isImporting}
                    className="text-yellow-500 hover:text-yellow-400"
                  >
                    <Loader2 className="h-3 w-3 mr-1" />
                    Retry Failed
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importing... This may take a few minutes for large files.</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Import Button - Only show in batch mode */}
          {importMode === "batch" && (
            <Button
              onClick={handleBatchImport}
              disabled={files.filter((f) => f.status === "pending").length === 0 || isImporting}
              className="w-full bg-spotify-green hover:bg-spotify-green/90"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {files.filter((f) => f.status === "pending").length}{" "}
                  {files.filter((f) => f.status === "pending").length === 1 ? "file" : "files"}
                </>
              )}
            </Button>
          )}

          {/* Overall Summary for Individual Mode */}
          {importMode === "individual" && files.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-sm mb-2">Import Summary</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total files:</span>
                  <span>{files.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-500">Successful:</span>
                  <span className="text-green-500">
                    {files.filter((f) => f.status === "success").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-500">Failed:</span>
                  <span className="text-red-500">
                    {files.filter((f) => f.status === "error").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending:</span>
                  <span>{files.filter((f) => f.status === "pending").length}</span>
                </div>
                {files.filter((f) => f.status === "success").length > 0 && (
                  <>
                    <div className="border-t border-muted-foreground/20 my-2"></div>
                    <div className="flex justify-between font-medium">
                      <span className="text-spotify-green">Total plays imported:</span>
                      <span className="text-spotify-green">
                        {files
                          .filter((f) => f.status === "success")
                          .reduce((sum, f) => sum + (f.result?.imported || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Success Result for Batch Mode */}
          {overallResult && overallResult.success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Import Complete</AlertTitle>
              <AlertDescription className="text-green-400/80">
                <ul className="mt-2 space-y-1">
                  <li>Imported: {overallResult.imported.toLocaleString()} plays</li>
                  <li>Duplicates skipped: {overallResult.duplicates.toLocaleString()}</li>
                  {overallResult.failed > 0 && (
                    <li className="text-yellow-400">
                      Failed: {overallResult.failed.toLocaleString()} tracks
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Error Details */}
          {overallResult && overallResult.errors.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-sm mb-2 text-yellow-500">
                Some tracks could not be imported:
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {overallResult.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {overallResult.errors.length > 20 && (
                  <li className="text-muted-foreground/50">
                    ...and {overallResult.errors.length - 20} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
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
                  <h3 className="font-medium mb-2">What&apos;s Included</h3>
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
        </TabsContent>

        <TabsContent value="wrapped" className="space-y-6">
          <Card className="glass border-purple-500/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Sparkles className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Your Spotify Wrapped</CardTitle>
                  <CardDescription>
                    Discover your personalized year-in-review
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 space-y-4">
                <p className="text-muted-foreground">
                  Get a beautiful, personalized summary of your listening habits. See your top artists,
                  tracks, genres, and more with stunning visualizations.
                </p>
                <Link href="/dashboard/wrapped">
                  <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    <Sparkles className="h-5 w-5 mr-2" />
                    View Your Wrapped
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Music className="h-8 w-8 mx-auto mb-2 text-spotify-green" />
                  <h4 className="font-medium mb-1">Top Tracks</h4>
                  <p className="text-xs text-muted-foreground">Your most played songs</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-spotify-green" />
                  <h4 className="font-medium mb-1">Top Artists</h4>
                  <p className="text-xs text-muted-foreground">Artists you loved most</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-spotify-green" />
                  <h4 className="font-medium mb-1">Listening Stats</h4>
                  <p className="text-xs text-muted-foreground">Detailed insights</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
