import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's Spotify access token
    const account = await prisma.account.findFirst({
      where: { userId, provider: "spotify" },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "Spotify not connected" },
        { status: 400 }
      );
    }

    // Fetch currently playing from Spotify
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });

    // 204 means nothing is playing
    if (response.status === 204) {
      return NextResponse.json({
        isPlaying: false,
        track: null,
      });
    }

    if (!response.ok) {
      // Token might be expired
      if (response.status === 401) {
        return NextResponse.json({
          isPlaying: false,
          track: null,
          error: "Token expired",
        });
      }
      return NextResponse.json({
        isPlaying: false,
        track: null,
      });
    }

    const data = await response.json();

    // Check if it's actually a track (not a podcast, etc.)
    if (!data.item || data.currently_playing_type !== "track") {
      return NextResponse.json({
        isPlaying: data.is_playing || false,
        track: null,
        type: data.currently_playing_type,
      });
    }

    const track = data.item;

    return NextResponse.json({
      isPlaying: data.is_playing,
      track: {
        id: track.id,
        name: track.name,
        artistName: track.artists.map((a: { name: string }) => a.name).join(", "),
        albumName: track.album.name,
        albumImageUrl: track.album.images[0]?.url || null,
        durationMs: track.duration_ms,
        progressMs: data.progress_ms,
        spotifyUrl: track.external_urls?.spotify || null,
      },
      device: data.device
        ? {
            name: data.device.name,
            type: data.device.type,
            volume: data.device.volume_percent,
          }
        : null,
    });
  } catch (error) {
    console.error("Now Playing API error:", error);
    return NextResponse.json(
      { isPlaying: false, track: null },
      { status: 200 }
    );
  }
}
