import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { SPORTS, type Settings, type Sport } from "@/lib/types";
import { isDayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MAX_MULTIPLIER = 1000;
const MAX_GOAL = 100000;

export async function PUT(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isAdmin(me)) {
    return NextResponse.json(
      { error: "Only the league admin can change the scoring." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawMultipliers = (body.multipliers ?? {}) as Record<string, unknown>;
  const multipliers = {} as Record<Sport, number>;

  for (const sport of SPORTS) {
    const n = Number(rawMultipliers[sport]);
    if (!Number.isFinite(n) || n < 0 || n > MAX_MULTIPLIER) {
      return NextResponse.json(
        { error: `${sport} points per km must be between 0 and ${MAX_MULTIPLIER}.` },
        { status: 400 },
      );
    }
    multipliers[sport] = Math.round(n * 100) / 100;
  }

  const rawElevation = (body.elevationPer100m ?? {}) as Record<string, unknown>;
  const elevationPer100m = {} as Record<Sport, number>;
  for (const sport of SPORTS) {
    const n = Number(rawElevation[sport] ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > MAX_MULTIPLIER) {
      return NextResponse.json(
        { error: `${sport} points per 100 m must be between 0 and ${MAX_MULTIPLIER}.` },
        { status: 400 },
      );
    }
    elevationPer100m[sport] = Math.round(n * 100) / 100;
  }

  const weeklyGoal = Number(body.weeklyGoal);
  if (!Number.isFinite(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > MAX_GOAL) {
    return NextResponse.json(
      { error: `The weekly target must be between 1 and ${MAX_GOAL} points.` },
      { status: 400 },
    );
  }

  if (!isDayKey(body.seasonStart)) {
    return NextResponse.json({ error: "Pick a valid season start date." }, { status: 400 });
  }

  const forfeit = typeof body.forfeit === "string" ? body.forfeit.trim().slice(0, 120) : "";
  if (!forfeit) {
    return NextResponse.json({ error: "Give the forfeit some words." }, { status: 400 });
  }

  const settings: Settings = {
    multipliers,
    elevationPer100m,
    weeklyGoal: Math.round(weeklyGoal * 10) / 10,
    seasonStart: body.seasonStart,
    forfeit,
  };

  await getStore().setSettings(settings);
  return NextResponse.json(await readState());
}
