import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deduplicateArtistsAndAlbums, getDuplicatesCount } from "@/lib/deduplicate-artists";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Deduplicate API] Starting deduplication");

    // Deduplicate artists and albums
    const result = await deduplicateArtistsAndAlbums();

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Deduplicate API] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get count of duplicates
    const count = await getDuplicatesCount();

    return NextResponse.json(count);
  } catch (error) {
    console.error("[Deduplicate API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
