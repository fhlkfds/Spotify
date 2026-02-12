import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchMissingImages, getMissingImagesCount } from "@/lib/fetch-images";
import { getUserAccessToken } from "@/lib/import";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get access token
    const accessToken = await getUserAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Spotify access token not available. Please reconnect your account." },
        { status: 401 }
      );
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    console.log(`[Fetch Images API] Fetching images for up to ${limit} items`);

    // Fetch missing images
    const result = await fetchMissingImages(accessToken, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Fetch Images API] Error:", error);
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

    // Get count of missing images
    const count = await getMissingImagesCount();

    return NextResponse.json(count);
  } catch (error) {
    console.error("[Fetch Images API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
