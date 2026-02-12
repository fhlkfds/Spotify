import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  parseImportFile,
  importHistory,
  getUserAccessToken,
  clearTrackCache,
} from "@/lib/import";

export async function POST(request: NextRequest) {
  try {
    console.log("[Import API] Request received");
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log("[Import API] No session found");
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    console.log("[Import API] User authenticated:", session.user.id);

    const userId = session.user.id;

    // Get access token for Spotify API calls
    console.log("[Import API] Getting access token for user:", userId);
    const accessToken = await getUserAccessToken(userId);
    if (!accessToken) {
      console.log("[Import API] No access token found");
      return NextResponse.json(
        { error: "Spotify access token not available. Please reconnect your account." },
        { status: 401 }
      );
    }

    console.log("[Import API] Access token obtained");

    // Parse multipart form data
    console.log("[Import API] Parsing form data");
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      console.log("[Import API] No files provided");
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    console.log(`[Import API] Received ${files.length} file(s)`);

    // Clear cache at start of import session
    clearTrackCache();

    let totalImported = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    // Process each file
    for (const file of files) {
      if (!file.name.endsWith(".json")) {
        allErrors.push(`Skipped ${file.name}: not a JSON file`);
        continue;
      }

      try {
        console.log(`[Import API] Processing file: ${file.name}`);
        const content = await file.text();
        console.log(`[Import API] File content length: ${content.length} characters`);
        const entries = parseImportFile(content);
        console.log(`[Import API] Parsed ${entries.length} entries from ${file.name}`);

        if (entries.length === 0) {
          allErrors.push(`${file.name}: No valid entries found`);
          continue;
        }

        const result = await importHistory(userId, accessToken, entries);

        totalImported += result.imported;
        totalDuplicates += result.duplicates;
        totalFailed += result.failed;
        totalSkipped += result.skipped;
        allErrors.push(...result.errors);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        allErrors.push(`Failed to process ${file.name}: ${message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: totalImported,
      duplicates: totalDuplicates,
      failed: totalFailed,
      skipped: totalSkipped,
      errors: allErrors.slice(0, 100), // Limit errors returned
      message: `Imported ${totalImported} plays (${totalDuplicates} duplicates, ${totalFailed} failed)`,
    });
  } catch (error) {
    console.error("[Import API] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Import API] Error stack:", stack);
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
