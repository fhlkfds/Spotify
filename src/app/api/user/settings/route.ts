import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// User settings stored as JSON in a dedicated field
// For simplicity, we'll use a key-value approach in a settings table or localStorage on client

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For now, return empty settings - actual settings will be stored client-side
    // In a production app, you'd have a UserSettings model
    return NextResponse.json({
      location: null,
      autoSync: true,
      autoSyncInterval: 15, // minutes
    });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // In a production app, you'd save these to the database
    // For now, we acknowledge the settings
    return NextResponse.json({
      success: true,
      settings: body,
    });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
