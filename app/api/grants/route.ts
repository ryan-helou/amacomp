import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { isDayKey, weekStart, weekEnd } from "@/lib/dates";
import { standingsForRange } from "@/lib/scoring";
import { GRANT_SPORT, isExcuse, type ActivitySource } from "@/lib/types";
import { parseNote } from "@/lib/validate";

export const dynamic = "force-dynamic";

// A single discretionary award can't exceed a sane ceiling — a top-up to quota
// is ~100, and this still leaves room for a generous make-good without letting a
// fat finger award a season's worth of points in one tap.
const MAX_GRANT = 10000;

/**
 * Admin awards points directly to an athlete for a given week — the make-good
 * for a week someone genuinely couldn't complete, so a missed week doesn't sink
 * their season. Two kinds:
 *   - `excuse`: waive the week. The server tops the athlete up to exactly the
 *     weekly quota (no client-supplied amount), recorded as an `excuse` grant so
 *     the recap shows them excused rather than on the hook for the forfeit.
 *   - `award` (default): a discretionary amount the admin types in.
 * Both store as an activity-log row so they flow through the same weekly-quota
 * and season aggregation as everything else. Only the league admin may create one.
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
  const kind = body.kind === "excuse" ? "excuse" : "award";

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
  const occurredOn = body.occurredOn;

  let points: number;
  let source: ActivitySource;

  if (kind === "excuse") {
    // Waive the week: top the athlete up to exactly the weekly quota. Computed
    // server-side from their current standing for that week, so it can't be
    // gamed and always lands them on quota no matter what they'd already logged.
    const [athletes, activities, settings] = await Promise.all([
      getStore().listAthletes(),
      getStore().listActivities(),
      getStore().getSettings(),
    ]);
    const range: [string, string] = [weekStart(occurredOn), weekEnd(occurredOn)];
    // Idempotent: a week already excused stays a single excuse — don't stack a
    // second (possibly 0-point) marker on a double-tap.
    const already = activities.some(
      (a) =>
        a.athleteId === athleteId &&
        isExcuse(a) &&
        a.occurredOn >= range[0] &&
        a.occurredOn <= range[1],
    );
    if (already) return NextResponse.json(await readState());
    // `award: false` waives the week WITHOUT paying for it: the athlete is off
    // the hook for the forfeit but gains nothing toward the season. Ryan's
    // framing for someone away — "he doesn't need to complete the quota, but he
    // will not be awarded a hundred points either". Topping up is still the
    // default so existing behaviour is unchanged.
    if (body.award === false) {
      points = 0;
    } else {
      const row = standingsForRange(athletes, activities, settings, range).find(
        (s) => s.athlete.id === athleteId,
      );
      const current = row?.points ?? 0;
      points = Math.max(Math.round((settings.weeklyGoal - current) * 10) / 10, 0);
    }
    source = "excuse";
  } else {
    const n = Number(body.points);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_GRANT) {
      return NextResponse.json(
        { error: `Award between 1 and ${MAX_GRANT} points.` },
        { status: 400 },
      );
    }
    points = Math.round(n * 10) / 10;
    source = "admin";
  }

  await getStore().createActivity(
    {
      athleteId,
      sport: GRANT_SPORT,
      km: 0,
      occurredOn,
      note: parseNote(body.note),
      points,
    },
    source,
  );

  return NextResponse.json(await readState());
}
