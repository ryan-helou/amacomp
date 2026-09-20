import { activityLocalDay, sportOf, toImport, type StravaActivity } from "./strava";
import { RESET_HOUR, logDayAt, toDayKey, weekStart } from "./dates";

/**
 * Which day a Strava import lands on decides which WEEK it scores in, so a bug
 * here costs someone a real forfeit — the same reason the scoring rules get a
 * test. Run with `npm test`.
 *
 * The case that matters: someone runs at 1 AM Monday. Hand-logged, that's Sunday
 * (last week), because the client sends its own reset-shifted log day. Auto-synced
 * it used to be Monday, so the same session scored into a different week depending
 * on how it got logged — and since sync fires on every state read, Strava usually
 * won the race.
 *
 * The rollover is now the league's single `RESET_HOUR` rather than a per-athlete
 * setting, so the DEFAULT argument is the one that ships. The explicit-argument
 * cases below stay to pin the arithmetic itself.
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}

/** A Strava activity that started at the given athlete-local wall clock. Strava
 *  tags start_date_local with a "Z" it doesn't mean; we mirror that here. */
function ran(localIso: string): StravaActivity {
  return { id: 1, sport_type: "Run", distance: 10_000, start_date_local: localIso };
}

function rode(elevation: number | undefined): StravaActivity {
  return {
    id: 2, sport_type: "Ride", distance: 20_000,
    start_date_local: "2026-08-18T09:00:00Z", total_elevation_gain: elevation,
  };
}

/** The day a hand-logged session gets, i.e. what the client puts in
 *  `occurredOn`: `todayWithReset` at that moment. Mirrors lib/dates.ts. */
function manualDay(y: number, mo: number, d: number, h: number, mi: number, reset: number) {
  const at = new Date(y, mo - 1, d, h, mi).getTime();
  return toDayKey(new Date(at - reset * 3_600_000));
}

console.log("\nactivityLocalDay — reset hour");
{
  // Mon 2026-08-24 is a week start; Sun 2026-08-23 belongs to the week before.
  check("1:30 AM Mon, reset 3 -> Sunday (previous week)",
    activityLocalDay(ran("2026-08-24T01:30:00Z"), 3), "2026-08-23");
  check("1:30 AM Mon, reset 0 -> Monday (no shift)",
    activityLocalDay(ran("2026-08-24T01:30:00Z"), 0), "2026-08-24");
  check("5:57 AM Mon, reset 3 -> Monday (well past rollover)",
    activityLocalDay(ran("2026-08-24T05:57:00Z"), 3), "2026-08-24");
  check("3:00 AM Mon, reset 3 -> Monday (rollover is inclusive)",
    activityLocalDay(ran("2026-08-24T03:00:00Z"), 3), "2026-08-24");
  check("2:59 AM Mon, reset 3 -> Sunday (last minute of the old day)",
    activityLocalDay(ran("2026-08-24T02:59:00Z"), 3), "2026-08-23");
  check("11:00 PM Sun, reset 3 -> Sunday (evening is never shifted)",
    activityLocalDay(ran("2026-08-23T23:00:00Z"), 3), "2026-08-23");
  // The default is the league rollover, not 0. A caller that forgets the
  // argument must not quietly file a 1 AM session into the wrong week.
  check("defaults to the league rollover, not to no shift",
    activityLocalDay(ran("2026-08-24T01:30:00Z")), "2026-08-23");
  check("the default IS RESET_HOUR",
    activityLocalDay(ran("2026-08-24T01:30:00Z")),
    activityLocalDay(ran("2026-08-24T01:30:00Z"), RESET_HOUR));
}

console.log("\nactivityLocalDay — week bucketing (the forfeit)");
{
  check("1:30 AM Mon, reset 3 scores in the previous week",
    weekStart(activityLocalDay(ran("2026-08-24T01:30:00Z"), 3)!), "2026-08-17");
  check("1:30 AM Mon, reset 0 scores in the new week",
    weekStart(activityLocalDay(ran("2026-08-24T01:30:00Z"), 0)!), "2026-08-24");
  // As shipped — no argument — a Sunday-night run stays in the week it closed.
  check("1:30 AM Mon by default scores in the previous week",
    weekStart(activityLocalDay(ran("2026-08-24T01:30:00Z"))!), "2026-08-17");
}

console.log("\nan import agrees with the log form's own default day");
{
  // The log form defaults `occurredOn` to logDayAt(now). An import of the same
  // moment must pick that same day, or the two write paths disagree again.
  for (const [h, mi] of [[0, 15], [1, 30], [2, 59], [3, 0], [5, 57], [23, 0]]) {
    const hh = String(h).padStart(2, "0");
    const mm = String(mi).padStart(2, "0");
    check(`${hh}:${mm} Mon — import matches the form default`,
      activityLocalDay(ran(`2026-08-24T${hh}:${mm}:00Z`)),
      logDayAt(new Date(2026, 7, 24, h, mi).getTime()));
  }
}

console.log("\nStrava import agrees with a hand-logged session");
{
  // The regression: for the same wall-clock moment both paths must pick the
  // same day, or one session scores differently depending on how it was logged.
  for (const reset of [0, 3]) {
    for (const [h, mi] of [[0, 15], [1, 30], [2, 59], [3, 0], [5, 57], [23, 0]]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(mi).padStart(2, "0");
      check(`${hh}:${mm} Mon, reset ${reset}`,
        activityLocalDay(ran(`2026-08-24T${hh}:${mm}:00Z`), reset),
        manualDay(2026, 8, 24, h, mi, reset));
    }
  }
}

console.log("\nactivityLocalDay — fallbacks");
{
  // No start_date_local: shift the UTC instant by utc_offset, then by reset.
  check("utc_offset fallback applies the reset too",
    activityLocalDay(
      { id: 1, start_date: "2026-08-24T05:30:00Z", utc_offset: -14_400 }, 3,
    ),
    "2026-08-23", // 05:30Z - 4h = 01:30 local, - 3h reset = Sunday
  );
  check("date-only local string is taken as-is (no clock to shift)",
    activityLocalDay({ id: 1, start_date_local: "2026-08-24" }, 3), "2026-08-24");
  check("no usable date -> null", activityLocalDay({ id: 1 }, 3), null);
  check("unparseable start_date -> null",
    activityLocalDay({ id: 1, start_date: "not a date" }, 3), null);
}

console.log("\ntoImport threads the reset hour through");
{
  const mapped = toImport("ath1", ran("2026-08-24T01:30:00Z"), 3);
  check("occurredOn is the reset-shifted day", mapped?.input.occurredOn, "2026-08-23");
  check("still maps the sport", mapped?.input.sport, "run");
  check("km comes from metres", mapped?.input.km, 10);
  // importActivities calls toImport with no reset argument, so this is the path
  // that actually runs in production.
  check("with no argument it still shifts (the shipped path)",
    toImport("ath1", ran("2026-08-24T01:30:00Z"))?.input.occurredOn, "2026-08-23");
}

console.log("\ntoImport carries the ascent");
{
  check("elevation comes across in metres", toImport("a", rode(512.4))?.input.elevationM, 512.4);
  check("a flat ride is 0, not unknown", toImport("a", rode(0))?.input.elevationM, 0);
  // Strava omits the field when it has no elevation stream. That is genuinely
  // unknown and must stay null, or a ride would score as certified flat.
  check("a missing field stays null", toImport("a", rode(undefined))?.input.elevationM, null);
  check("rounded to a tenth of a metre", toImport("a", rode(311.26))?.input.elevationM, 311.3);
  check("a negative reading is clamped to 0", toImport("a", rode(-5))?.input.elevationM, 0);
}

console.log("\nwhat counts as a gym lift");
{
  const as = (sport_type: string) => sportOf({ id: 3, sport_type, start_date_local: "2026-09-19T15:00:00Z" });
  check("WeightTraining is a lift", as("WeightTraining"), "gym");
  check("Crossfit is a lift", as("Crossfit"), "gym");
  check("HIIT is a lift", as("HighIntensityIntervalTraining"), "gym");
  // Strava's catch-all type. Volleyball, squash and a stretch all land here, so
  // it can't be a lift — this is what handed amaGoh gym points for volleyball.
  check("a plain Workout is not", as("Workout"), null);
  check("and neither is a walk", as("Walk"), null);
  check("runs and rides are untouched", [as("TrailRun"), as("VirtualRide")], ["run", "bike"]);
}

console.log(failures === 0 ? "\nAll strava date tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
