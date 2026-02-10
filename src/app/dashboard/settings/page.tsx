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

export default function SettingsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.name.endsWith(".json")
    );

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter((file) =>
      file.name.endsWith(".json")
    );

    if (selectedFiles.length > 0) {
      setFiles((prev) => [...prev, ...selectedFiles]);
      setResult(null);
      setError(null);
    }

    // Reset input
    e.target.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
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
              isImporting && "opacity-50 pointer-events-none"
            )}
          >
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
                disabled={isImporting}
              />
              <span className="text-spotify-green hover:underline">browse files</span>
            </label>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Selected files:</h4>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between bg-muted/50 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={isImporting}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
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

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={files.length === 0 || isImporting}
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
                Import {files.length} {files.length === 1 ? "file" : "files"}
              </>
            )}
          </Button>

          {/* Success Result */}
          {result && result.success && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-500">Import Complete</AlertTitle>
              <AlertDescription className="text-green-400/80">
                <ul className="mt-2 space-y-1">
                  <li>Imported: {result.imported.toLocaleString()} plays</li>
                  <li>Duplicates skipped: {result.duplicates.toLocaleString()}</li>
                  {result.failed > 0 && (
                    <li className="text-yellow-400">
                      Failed: {result.failed.toLocaleString()} tracks
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
          {result && result.errors.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium text-sm mb-2 text-yellow-500">
                Some tracks could not be imported:
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {result.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 20 && (
                  <li className="text-muted-foreground/50">
                    ...and {result.errors.length - 20} more
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
