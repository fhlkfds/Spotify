import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncUserPlays } from "@/lib/sync";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncUserPlays(session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      newPlays: result.newPlays,
      message: `Synced ${result.newPlays} new plays`,
    });
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Cron endpoint for automated syncing
export async function GET(request: NextRequest) {
  // Verify cron secret for automated requests
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Import prisma here to avoid issues
    const { prisma } = await import("@/lib/db");

    // Get all users with Spotify accounts
    const users = await prisma.user.findMany({
      where: {
        accounts: {
          some: { provider: "spotify" },
        },
      },
    });

    const results = await Promise.all(
      users.map(async (user) => {
        const result = await syncUserPlays(user.id);
        return { userId: user.id, ...result };
      })
    );

    const totalNewPlays = results.reduce((sum, r) => sum + r.newPlays, 0);
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      usersProcessed: users.length,
      successfulSyncs: successCount,
      totalNewPlays,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
