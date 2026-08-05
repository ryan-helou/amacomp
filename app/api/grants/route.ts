import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { isDayKey } from "@/lib/dates";
import { GRANT_SPORT } from "@/lib/types";
import { parseNote } from "@/lib/validate";

export const dynamic = "force-dynamic";

// A single grant can't exceed a sane ceiling — a top-up to quota is ~100, and
// this still leaves room for a generous make-good without letting a fat finger
// award a season's worth of points in one tap.
const MAX_GRANT = 10000;

/**
 * Admin awards points directly to an athlete for a given week — the make-good
 * for a week someone genuinely couldn't complete, so a missed week doesn't sink
 * their season. Stored as an activity-log row (source `admin`) so it flows
 * through the same weekly-quota and season aggregation as everything else, but
 * carries a flat points amount instead of a distance and always renders as a
 * grant. Only the league admin may create one.
 */
export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isAdmin(me)) {
    return NextResponse.json(
      { error: "Only the league admin can award points." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
  const athlete = athleteId ? await getStore().getAthlete(athleteId) : null;
  if (!athlete) {
    return NextResponse.json({ error: "Pick who this is for." }, { status: 400 });
  }

  // The date lands the grant in the right week (and so the right season). The
  // client sends a day inside the target week.
  if (!isDayKey(body.occurredOn)) {
    return NextResponse.json({ error: "Pick a valid week." }, { status: 400 });
  }

  const points = Number(body.points);
  if (!Number.isFinite(points) || points <= 0 || points > MAX_GRANT) {
    return NextResponse.json(
      { error: `Award between 1 and ${MAX_GRANT} points.` },
      { status: 400 },
    );
  }

  await getStore().createActivity(
    {
      athleteId,
      sport: GRANT_SPORT,
      km: 0,
      occurredOn: body.occurredOn,
      note: parseNote(body.note),
      points: Math.round(points * 10) / 10,
    },
    "admin",
  );

  return NextResponse.json(await readState());
}
