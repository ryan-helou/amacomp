import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete } from "@/lib/session";
import { readState } from "@/lib/state";
import { isDayKey, leagueToday } from "@/lib/dates";
import { isSport, SPORT_UNIT } from "@/lib/types";
import { MAX_ELEVATION_M, MAX_KM, parseElevation, parseKm, parseNote } from "@/lib/validate";
import { notifyOvertakes, notifyQuotaHits, notifySeasonLead } from "@/lib/push";
import { waitingFor } from "@/lib/waiting";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (!isSport(body.sport)) {
    return NextResponse.json({ error: "Pick a discipline." }, { status: 400 });
  }
  // A gym workout is flat — one logged session, worth its fixed points. The
  // stored quantity is forced to 1 so the client can't inflate it.
  let km: number | null;
  if (SPORT_UNIT[body.sport] === "flat") {
    km = 1;
  } else {
    km = parseKm(body.km);
    if (km === null) {
      return NextResponse.json(
        { error: `Enter a distance between 0 and ${MAX_KM} km.` },
        { status: 400 },
      );
    }
  }
  if (!isDayKey(body.occurredOn)) {
    return NextResponse.json({ error: "Pick a valid date." }, { status: 400 });
  }

  // Blank is fine (unknown climb); a supplied-but-nonsense value is not.
  const elevationM = parseElevation(body.elevationM);
  if (elevationM === undefined) {
    return NextResponse.json(
      { error: `Enter an ascent between 0 and ${MAX_ELEVATION_M} m, or leave it blank.` },
      { status: 400 },
    );
  }

  // A man still on the coming-soon screen cannot log a session, and this is
  // the same predicate the screen uses (lib/waiting). Without it he can post
  // one from the API — and because the screen hides itself the moment he has
  // an activity, that single request would drop him onto the very board the
  // screen exists to keep him off.
  const [allActivities, allSettings] = await Promise.all([
    getStore().listActivities(),
    getStore().getSettings(),
  ]);
  const held = waitingFor(me, allActivities, allSettings, leagueToday());
  if (held) {
    return NextResponse.json(
      { error: `${held.label} hasn't started yet. The board opens on ${held.start}.` },
      { status: 403 },
    );
  }

  const created = await getStore().createActivity({
    athleteId: me.id,
    sport: body.sport,
    km,
    occurredOn: body.occurredOn,
    note: parseNote(body.note),
    elevationM,
    // Only meaningful for a swim; anything else is stored as unknown so the
    // column never claims a ride happened in a lake.
    openWater:
      body.sport === "swim" && typeof body.openWater === "boolean" ? body.openWater : null,
  });

  const state = await readState();

  // Fire-and-forget: notify anyone this session leapfrogged this week. Never
  // let a push failure affect the log response.
  void notifyOvertakes(
    me.id,
    state.athletes,
    state.activities,
    [created.id],
    state.settings,
  ).catch(() => {});
  void notifyQuotaHits(
    me.id,
    state.athletes,
    state.activities,
    [created.id],
    state.settings,
  ).catch(() => {});
  // Takes no batch: it compares against the last leader announced, so it catches
  // a change however it happened.
  void notifySeasonLead(state.athletes, state.activities, state.settings).catch(() => {});

  return NextResponse.json(state);
}
