import { NextResponse } from "next/server";
import { getStore, normalizeName } from "@/lib/db";
import { currentAthlete, signIn, signOut } from "@/lib/session";
import { readState } from "@/lib/state";
import { isAvatarColor, isAvatarGlyph } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readState());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? normalizeName(body.name) : "";

  if (!name) {
    return NextResponse.json({ error: "Enter your name to continue." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "Keep the name under 40 characters." }, { status: 400 });
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’.-]*$/u.test(name)) {
    return NextResponse.json(
      { error: "Names can use letters, numbers, spaces, apostrophes and hyphens." },
      { status: 400 },
    );
  }

  await signIn(name);
  return NextResponse.json(await readState());
}

export async function PATCH(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    avatarColor?: unknown;
    avatarGlyph?: unknown;
  };
  const store = getStore();

  // Avatar fields come through this endpoint so the settings sheet doesn't need
  // a second route. Each field is optional; whichever was sent gets applied, and
  // unknown/null values fall back to the default hash.
  const hasAvatar =
    Object.prototype.hasOwnProperty.call(body, "avatarColor") ||
    Object.prototype.hasOwnProperty.call(body, "avatarGlyph");

  if (hasAvatar) {
    // Each field is optional and falls back to the athlete's current value —
    // callers can send just a colour change or just a glyph change. `null`
    // explicitly clears the pick and reverts to the default hash / initials.
    const color = Object.prototype.hasOwnProperty.call(body, "avatarColor")
      ? body.avatarColor === null
        ? null
        : isAvatarColor(body.avatarColor)
          ? body.avatarColor
          : "invalid"
      : me.avatarColor;
    const glyph = Object.prototype.hasOwnProperty.call(body, "avatarGlyph")
      ? body.avatarGlyph === null
        ? null
        : isAvatarGlyph(body.avatarGlyph)
          ? body.avatarGlyph
          : "invalid"
      : me.avatarGlyph;
    if (color === "invalid" || glyph === "invalid") {
      return NextResponse.json({ error: "Pick a valid colour and symbol." }, { status: 400 });
    }
    await store.setAvatar(me.id, color, glyph);
  }

  return NextResponse.json(await readState());
}

export async function DELETE() {
  await signOut();
  return NextResponse.json(await readState());
}
