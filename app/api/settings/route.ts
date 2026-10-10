import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { SPORTS, type RateChange, type Settings, type Sport } from "@/lib/types";
import { isDayKey, leagueToday } from "@/lib/dates";
import { ratesOn } from "@/lib/scoring";

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

  // A rate edit takes effect FROM TODAY — it does not rewrite the season.
  //
  // The base rates are left exactly as they are and the difference is recorded
  // as a dated change, so every week already ridden keeps the points it was
  // ridden for, along with the forfeit it did or didn't trigger. Saving the same
  // numbers back records nothing.
  const current = await getStore().getSettings();
  const from = leagueToday();
  const effective = ratesOn(from, current);
  const movedMultipliers: Partial<Record<Sport, number>> = {};
  const movedElevation: Partial<Record<Sport, number>> = {};
  for (const sport of SPORTS) {
    if (multipliers[sport] !== effective.multipliers[sport]) {
      movedMultipliers[sport] = multipliers[sport];
    }
    if (elevationPer100m[sport] !== effective.elevationPer100m[sport]) {
      movedElevation[sport] = elevationPer100m[sport];
    }
  }
  const moved =
    Object.keys(movedMultipliers).length > 0 || Object.keys(movedElevation).length > 0;

  // Drop any change already dated today so a run of edits in one sitting settles
  // on the final numbers instead of stacking up entries nobody can read.
  const rateChanges: RateChange[] = (current.rateChanges ?? []).filter((c) => c.from !== from);
  if (moved) {
    rateChanges.push({
      from,
      ...(Object.keys(movedMultipliers).length > 0 && { multipliers: movedMultipliers }),
      ...(Object.keys(movedElevation).length > 0 && { elevationPer100m: movedElevation }),
    });
    rateChanges.sort((a, b) => a.from.localeCompare(b.from));
  }

  // Open water is retroactive by instruction, so unlike the multipliers above it
  // is written straight through rather than recorded as a dated change.
  const rawOpenWater = Number(body.openWaterPerKm);
  const openWaterPerKm =
    Number.isFinite(rawOpenWater) && rawOpenWater >= 0 && rawOpenWater <= MAX_MULTIPLIER
      ? Math.round(rawOpenWater * 100) / 100
      : current.openWaterPerKm;

  // Retroactive like the open water rate, so written straight through rather
  // than recorded as a dated change.
  const rawAscent = Number(body.runAscentMetresPerKm);
  const runAscentMetresPerKm =
    Number.isFinite(rawAscent) && rawAscent >= 0 && rawAscent <= 10000
      ? Math.round(rawAscent)
      : current.runAscentMetresPerKm;

  const settings: Settings = {
    multipliers: current.multipliers,
    elevationPer100m: current.elevationPer100m,
    rateChanges,
    // Carried through untouched: this sheet doesn't edit per-athlete goals, and
    // dropping them here would quietly put everyone back on the league quota.
    goalChanges: current.goalChanges,
    openWaterPerKm,
    runAscentMetresPerKm,
    // This sheet doesn't edit them; carried through so a save here can't erase
    // the record of an all-time change before it has been announced.
    retroChanges: current.retroChanges,
    weeklyGoal: Math.round(weeklyGoal * 10) / 10,
    seasonStart: body.seasonStart,
    forfeit,
  };

  await getStore().setSettings(settings);
  return NextResponse.json(await readState());
}
