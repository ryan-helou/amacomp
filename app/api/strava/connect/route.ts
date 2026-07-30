import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentAthlete } from "@/lib/session";
import { authorizeUrl, stravaConfigured } from "@/lib/strava";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(req: NextRequest): string {
  return process.env.APP_URL || req.nextUrl.origin;
}

// Kick off the Strava OAuth flow. The athlete is already signed in (cookie), so
// the callback identifies them the same way; `state` is a CSRF token we
// echo-check on the way back.
export async function GET(req: NextRequest) {
  const me = await currentAthlete();
  if (!me) return NextResponse.redirect(new URL("/", baseUrl(req)));
  if (!stravaConfigured()) {
    return NextResponse.json({ error: "Strava isn't configured yet." }, { status: 503 });
  }
  const state = crypto.randomUUID();
  const redirectUri = `${baseUrl(req)}/api/strava/callback`;
  const res = NextResponse.redirect(authorizeUrl(redirectUri, state));
  res.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
