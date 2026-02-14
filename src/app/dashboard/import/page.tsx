"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FileState = "pending" | "uploading" | "success" | "error";

interface UploadFileItem {
  file: File;
  state: FileState;
  message?: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  failed: number;
  skipped: number;
}

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export default function ImportPage() {
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const progress = useMemo(() => {
    if (files.length === 0) return 0;
    const completed = files.filter((item) => item.state === "success" || item.state === "error").length;
    return Math.round((completed / files.length) * 100);
  }, [files]);

  const addFiles = useCallback((incoming: File[]) => {
    setError(null);

    const validFiles: UploadFileItem[] = [];
    const rejectedFiles: string[] = [];

    for (const file of incoming) {
      if (!file.name.toLowerCase().endsWith(".json")) {
        rejectedFiles.push(`${file.name}: only .json files are allowed`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejectedFiles.push(`${file.name}: exceeds 200MB limit`);
        continue;
      }

      validFiles.push({ file, state: "pending" });
    }

    if (rejectedFiles.length > 0) {
      setError(rejectedFiles.join(" | "));
    }

    if (validFiles.length > 0) {
      setResult(null);
      setFiles((prev) => [...prev, ...validFiles]);
    }
  }, []);

  const onFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(event.target.files || []));
      event.target.value = "";
    },
    [addFiles]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(event.dataTransfer.files || []));
    },
    [addFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const importFiles = useCallback(async () => {
    if (files.length === 0) {
      setError("Select at least one JSON file to import.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setResult(null);

    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of files) {
      setFiles((prev) =>
        prev.map((entry) => (entry.file === item.file ? { ...entry, state: "uploading", message: undefined } : entry))
      );

      try {
        const formData = new FormData();
        formData.append("files", item.file);

        const response = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed with status ${response.status}`);
        }

        imported += data.imported || 0;
        duplicates += data.duplicates || 0;
        failed += data.failed || 0;
        skipped += data.skipped || 0;

        setFiles((prev) =>
          prev.map((entry) =>
            entry.file === item.file
              ? { ...entry, state: "success", message: data.message || "Imported" }
              : entry
          )
        );
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Import failed";
        failed += 1;
        setFiles((prev) =>
          prev.map((entry) => (entry.file === item.file ? { ...entry, state: "error", message } : entry))
        );
      }
    }

    setResult({ imported, duplicates, failed, skipped });
    setIsImporting(false);
  }, [files]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import History</h1>
        <p className="text-muted-foreground">Upload Spotify history JSON files, up to 200MB per file.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop files or choose from disk. Only `.json` files are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDrop}
            className={cn(
              "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              isDragging ? "border-spotify-green bg-spotify-green/5" : "border-border hover:border-spotify-green/70"
            )}
          >
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Drop Spotify JSON files here</p>
            <p className="text-sm text-muted-foreground">Maximum size: 200MB per file</p>
            <input type="file" accept=".json,application/json" multiple onChange={onFileSelect} className="hidden" />
          </label>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {files.length > 0 && (
            <div className="space-y-3">
              {files.map((item, index) => (
                <div key={`${item.file.name}-${index}`} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileJson className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
                      {item.message && <p className="text-xs text-muted-foreground">{item.message}</p>}
                    </div>
                  </div>

                  <div className="ml-4 flex items-center gap-3">
                    {item.state === "pending" && <span className="text-xs text-muted-foreground">Pending</span>}
                    {item.state === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-spotify-green" />}
                    {item.state === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {item.state === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isImporting || item.state === "uploading"}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>

          <div className="flex gap-3">
            <Button onClick={importFiles} disabled={isImporting || files.length === 0}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Start Import"
              )}
            </Button>
            <Button
              variant="outline"
              disabled={isImporting || files.length === 0}
              onClick={() => {
                setFiles([]);
                setResult(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Imported</p>
                <p className="text-2xl font-semibold">{result.imported}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Duplicates</p>
                <p className="text-2xl font-semibold">{result.duplicates}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-semibold">{result.failed}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Skipped</p>
                <p className="text-2xl font-semibold">{result.skipped}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
