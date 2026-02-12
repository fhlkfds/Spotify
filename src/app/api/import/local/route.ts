import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importLocalFiles } from "@/lib/import-local";

export async function POST(request: NextRequest) {
  try {
    console.log("[Local Import API] Request received");
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log("[Local Import API] No session found");
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    console.log("[Local Import API] User authenticated:", session.user.id);
    const userId = session.user.id;

    // Import files from the import folder
    const result = await importLocalFiles(userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Local Import API] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log("[Local Import API] List files request");
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fs = require('fs');
    const path = require('path');

    const importDir = path.join(process.cwd(), 'import');

    if (!fs.existsSync(importDir)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(importDir)
      .filter((file: string) => file.endsWith('.json'))
      .map((file: string) => {
        const stats = fs.statSync(path.join(importDir, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
        };
      });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("[Local Import API] Error listing files:", error);
    return NextResponse.json({ files: [] });
  }
}
