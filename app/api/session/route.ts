import { NextResponse } from "next/server";
import { getStore, normalizeName } from "@/lib/db";
import { currentAthlete, isAdmin, signIn, signOut } from "@/lib/session";
import { nameProblem, renameInSettings } from "@/lib/rename";
import { loadoutFor } from "@/lib/pixelAvatar";
import { leagueLogToday } from "@/lib/dates";
import { readState } from "@/lib/state";
import { isAvatarColor, isAvatarGlyph } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readState());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? normalizeName(body.name) : "";

  const problem = nameProblem(name);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  await signIn(name);
  return NextResponse.json(await readState());
}

export async function PATCH(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    avatarColor?: unknown;
    avatarGlyph?: unknown;
    weightKg?: unknown;
    name?: unknown;
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

  // A new name, once a league day. Ryan, 2026-10-06.
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = typeof body.name === "string" ? normalizeName(body.name) : "";
    const problem = nameProblem(name);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    // Admin is "whoever is called Ryan" (lib/session), so the admin renaming
    // would hand the keys to nobody.
    if (isAdmin(me)) {
      return NextResponse.json(
        { error: "You're the admin, and the admin is whoever's called Ryan — so your name stays." },
        { status: 403 },
      );
    }
    if (name !== me.name) {
      const done = await store.renameAthlete(me.id, name, leagueLogToday());
      if (done === "taken") {
        return NextResponse.json({ error: `Somebody's already called ${name}.` }, { status: 409 });
      }
      if (done === "too-soon") {
        return NextResponse.json(
          { error: "You've already changed your name today. Try again tomorrow." },
          { status: 429 },
        );
      }
      // His generated look is built from his NAME, so a new name would be a
      // new face. Keep the old one by saving it as his outfit — anything he
      // had already saved wins over the generated parts.
      const saved = (await store.listLoadouts())[me.id] ?? {};
      await store.setLoadout(me.id, { ...loadoutFor(me.name), ...saved });
      // And the quota overrides that are keyed by name go with him.
      const settings = await store.getSettings();
      const moved = renameInSettings(settings, me.name, name);
      if (moved !== settings) await store.setSettings(moved);
    }
  }

  // Body weight, for the cycling W/kg records. Explicit null clears it back to
  // unknown, which is a real state — it stops those records being computed
  // rather than computing them against a guess.
  if (Object.prototype.hasOwnProperty.call(body, "weightKg")) {
    if (body.weightKg === null) {
      await store.setWeight(me.id, null);
    } else {
      const kg = Number(body.weightKg);
      if (!Number.isFinite(kg) || kg < 25 || kg > 250) {
        return NextResponse.json(
          { error: "Give a weight in kilograms, between 25 and 250." },
          { status: 400 },
        );
      }
      await store.setWeight(me.id, Math.round(kg * 10) / 10);
    }
  }

  return NextResponse.json(await readState());
}

export async function DELETE() {
  await signOut();
  return NextResponse.json(await readState());
}
