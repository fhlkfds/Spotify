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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get access token for Spotify API calls
    const accessToken = await getUserAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Spotify access token not available. Please reconnect your account." },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

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
        const content = await file.text();
        const entries = parseImportFile(content);

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
    console.error("Import API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
