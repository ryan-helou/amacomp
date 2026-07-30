import { NextResponse } from "next/server";
import { currentAthlete } from "@/lib/session";
import { getStore } from "@/lib/db";
import { readState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The client resizes to a small square before upload, so anything big is a
// misuse — cap it hard. base64 inflates ~4/3, so this bounds the stored text too.
const MAX_BYTES = 500 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

// Upload a profile photo (sent as a data URL). Overrides the Strava default.
export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { image?: unknown };
  if (typeof body.image !== "string") {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  const m = DATA_URL.exec(body.image);
  if (!m) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 400 });
  }
  const [, contentType, data] = m;
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large — try a smaller one." }, { status: 413 });
  }

  await getStore().setAvatarImage(me.id, data, contentType, Date.now());
  return NextResponse.json(await readState());
}

// Remove the uploaded photo — reverts to the Strava photo, then initials.
export async function DELETE() {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await getStore().clearAvatarImage(me.id);
  return NextResponse.json(await readState());
}
