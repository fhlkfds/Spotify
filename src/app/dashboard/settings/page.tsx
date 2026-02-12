"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Upload,
  FileJson,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
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
}

// Maximum entries per chunk to avoid timeouts (2000 = ~2-3 min processing time)
const MAX_ENTRIES_PER_CHUNK = 2000;

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
          Manage your account and import listening history
        </p>
      </div>

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
                          <div className="text-xs text-green-400/80 mt-1">
                            Imported: {fileStatus.result.imported.toLocaleString()} plays
                            {fileStatus.result.duplicates > 0 &&
                              ` (${fileStatus.result.duplicates} duplicates)`}
                          </div>
                        )}

                        {fileStatus.status === "error" && fileStatus.error && (
                          <div className="text-xs text-red-400 mt-1">{fileStatus.error}</div>
                        )}

                        {fileStatus.status === "importing" && (
                          <div className="text-xs text-blue-400 mt-1">Importing...</div>
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
    </div>
  );
}
