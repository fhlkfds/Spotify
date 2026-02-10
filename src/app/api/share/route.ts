import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Create a new share link (expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const shareLink = await prisma.shareLink.create({
      data: {
        userId,
        expiresAt,
      },
    });

    const shareUrl = `${process.env.NEXTAUTH_URL || ""}/share/${shareLink.id}`;

    return NextResponse.json({
      success: true,
      shareUrl,
      expiresAt: shareLink.expiresAt,
    });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
