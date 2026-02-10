import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SpotifyClient, refreshAccessToken } from "@/lib/spotify";
import type { RecommendedTrack, RecommendedArtist } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "track" or "artist"
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing type or id parameter" },
        { status: 400 }
      );
    }

    if (type !== "track" && type !== "artist") {
      return NextResponse.json(
        { error: "Type must be 'track' or 'artist'" },
        { status: 400 }
      );
    }

    // Get user's Spotify account
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "spotify",
      },
    });

    if (!account?.access_token || !account?.refresh_token) {
      return NextResponse.json(
        { error: "Spotify account not connected" },
        { status: 400 }
      );
    }

    let accessToken = account.access_token;

    // Check if token is expired and refresh if needed
    if (account.expires_at && Date.now() >= account.expires_at * 1000) {
      try {
        const refreshed = await refreshAccessToken(account.refresh_token);
        accessToken = refreshed.access_token;

        // Update stored tokens
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: refreshed.access_token,
            expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
            refresh_token: refreshed.refresh_token || account.refresh_token,
          },
        });
      } catch {
        return NextResponse.json(
          { error: "Failed to refresh Spotify token" },
          { status: 401 }
        );
      }
    }

    const spotify = new SpotifyClient(accessToken);

    if (type === "track") {
      // Get 10 recommended tracks based on the seed track
      const recommendations = await spotify.getRecommendations(id, 10);

      const tracks: RecommendedTrack[] = recommendations.tracks.map((track) => ({
        id: track.id,
        name: track.name,
        artistName: track.artists.map((a) => a.name).join(", "),
        albumName: track.album.name,
        albumImageUrl: track.album.images[0]?.url || null,
        durationMs: track.duration_ms,
        spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      }));

      return NextResponse.json({ recommendations: tracks });
    } else {
      // Get related artists (Spotify returns up to 20, we'll take 10)
      const related = await spotify.getRelatedArtists(id);

      const artists: RecommendedArtist[] = related.artists
        .slice(0, 10)
        .map((artist) => ({
          id: artist.id,
          name: artist.name,
          imageUrl: artist.images[0]?.url || null,
          genres: artist.genres.slice(0, 3),
          spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
        }));

      return NextResponse.json({ recommendations: artists });
    }
  } catch (error) {
    console.error("Recommendations API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
