import { FORM_DAYS, seasonRace } from "./race";
import { daysBetween } from "./dates";
import { DEFAULT_SETTINGS, type Activity, type Athlete, type Settings } from "./types";

/**
 * The season run-in.
 *
 * The numbers here decide whether someone three points off the lead is told to
 * push or told they're fine, so the arithmetic gets tested rather than trusted.
 * The traps worth guarding: the projection must not spend today twice (the rate
 * is measured over days INCLUDING today, so carrying it forward over days that
 * also include today inflates everyone), the chase target must be where the
 * leader is HEADING rather than where they are, and the season must not go
 * negative on days when it has opened by the calendar but not yet by the
 * kickoff. Run with `npm test`.
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
function close(label: string, actual: number, expected: number, tol = 0.005) {
  if (Math.abs(actual - expected) <= tol) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ~${expected}\n         actual    ${actual}`);
  }
}

const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  seasonStart: "2026-08-03",
  // One rate, flat, so a test that means to be about the race isn't quietly
  // also a test of the dated-rate table.
  rateChanges: [],
  multipliers: { swim: 10, bike: 1, run: 10, gym: 10 },
  runAscentMetresPerKm: 0,
};

function athlete(id: string, name: string): Athlete {
  return { id, name, weightKg: null, avatarColor: null, avatarGlyph: null, avatarUrl: null };
}
const ANA = athlete("a", "Ana");
const BEN = athlete("b", "Ben");
const CAL = athlete("c", "Cal");

let seq = 0;
/** A run of `km` on `day`, worth 10 points per km under SETTINGS. */
function run(who: Athlete, day: string, km: number): Activity {
  seq += 1;
  return {
    id: `x${seq}`,
    athleteId: who.id,
    sport: "run",
    km,
    occurredOn: day,
    note: null,
    source: "manual",
    points: null,
    elevationM: null,
    openWater: null,
    createdAt: `${day}T12:00:00Z`,
  };
}

console.log("\ndays: the season's own arithmetic");
{
  // Season 1 is 3 Aug – 30 Sep. On 8 Aug, six days have run (3rd through 8th)
  // and twenty-two remain after today (9th through 30th September is 53, so
  // check against the helper rather than a hand count).
  const r = seasonRace([ANA], [], SETTINGS, "2026-08-08")!;
  check("season 1 is found", r.season.number, 1);
  check("start is the kickoff, not the 1st", r.season.start, "2026-08-03");
  check("six days gone on the 8th, today included", r.daysGone, 6);
  check("days left excludes today", r.daysLeft, daysBetween("2026-08-08", "2026-09-30"));

  const last = seasonRace([ANA], [], SETTINGS, "2026-09-30")!;
  check("no days left on the final day", last.daysLeft, 0);

  // Calendar says August, the kickoff says the 3rd: the 1st is inside season 1's
  // month block but before it opens. Days gone must not go to zero or negative.
  const early = seasonRace([ANA], [], SETTINGS, "2026-08-01")!;
  check("a pre-kickoff day still reports at least one day gone", early.daysGone, 1);

  check("before season 1 there is no race", seasonRace([ANA], [], SETTINGS, "2025-01-01"), null);
}

console.log("\nthe projection carries recent form forward — without spending today twice");
{
  // Ana runs 10 km (100 pts) on the opening day. Viewed on 3 Aug the season is
  // one day old, so the form window is that one day: 100/day, over 58 days
  // still to come, projects 100 + 5800 = 5900.
  const acts = [run(ANA, "2026-08-03", 10)];
  const r = seasonRace([ANA], acts, SETTINGS, "2026-08-03")!;
  check("one day gone", r.daysGone, 1);
  check("58 days still to come", r.daysLeft, 58);
  check("the form window cannot outrun the season", r.formDays, 1);
  close("rate is points per day of form", r.rows[0].rate, 100);
  close("projection is now + rate x days left", r.rows[0].projected, 5900);

  // Once the season is older than the window, the window stops growing.
  const later = seasonRace([ANA], acts, SETTINGS, "2026-09-01")!;
  check("and then it settles at its full width", later.formDays, FORM_DAYS);
  close("form counts only what happened inside it", later.rows[0].formPoints, 0);
  close("so an athlete who has stopped projects flat", later.rows[0].projected, 100);
}

console.log("\nthe chase target is where the leader is heading, not where they are");
{
  // Ten days in (3–12 Aug), both scoring inside the form window. Ben leads on
  // 300, Ana has 200.
  const acts = [run(BEN, "2026-08-04", 30), run(ANA, "2026-08-04", 20)];
  const r = seasonRace([ANA, BEN], acts, SETTINGS, "2026-08-12")!;
  const ana = r.rows.find((x) => x.athlete.id === "a")!;
  const ben = r.rows.find((x) => x.athlete.id === "b")!;

  check("Ben leads", ben.rank, 1);
  check("the leader is not chasing anyone", ben.needPerDay, null);
  check("margin is the gap between first and second", r.margin, 100);
  close("Ana is 100 behind", ana.behind, 100);

  // The season is 10 days old, so the form window is those 10 days and holds
  // everything. Ben's rate is 300/10 = 30/day; 49 days remain, so he is heading
  // for 300 + 1470 = 1770. Ana needs (1770 - 200) / 49 = 32.04/day to land level.
  check("ten days gone", r.daysGone, 10);
  check("49 days left", r.daysLeft, 49);
  close("Ben projects to 1770", ben.projected, 1770);
  close("Ana must beat Ben's pace, not just close the gap", ana.needPerDay!, 1570 / 49);
  // The naive version — closing the gap alone — is 100/49 = 2.04, which would
  // tell someone 30 points a day adrift that two a day is enough.
  check(
    "and that is far more than merely closing the gap",
    ana.needPerDay! > (100 / 49) * 5,
    true,
  );
}

console.log("\nprojected order CAN differ from the table — the whole reason for form");
{
  // Viewed on 20 Sep, with 10 days to run. Ana banked everything in August and
  // has done nothing since; Ben is behind on the table but scoring right now.
  // A season average could never call this — it is a strictly increasing
  // function of points, so it would put Ana ahead in the projection too.
  const acts = [
    run(ANA, "2026-08-05", 200), // 2000 pts, long outside the form window
    run(BEN, "2026-08-05", 80), //   800 pts, same
    run(BEN, "2026-09-14", 40), //   400 pts, inside it -> 1200 total
    run(BEN, "2026-09-18", 40), //   400 pts, inside it -> 1600 total
  ];
  const r = seasonRace([ANA, BEN], acts, SETTINGS, "2026-09-20")!;
  const ana = r.rows.find((x) => x.athlete.id === "a")!;
  const ben = r.rows.find((x) => x.athlete.id === "b")!;

  check("Ana still leads the table", ana.rank, 1);
  check("Ben is second on points", ben.rank, 2);
  close("but Ana has scored nothing lately", ana.formPoints, 0);
  close("and Ben has scored 800 in the window", ben.formPoints, 800);
  check("so the projection flips them", [ben.projectedRank, ana.projectedRank], [1, 2]);
  check("and the race is called live", r.leadChanges, true);
}

console.log("\na procession is not called a race");
{
  const acts = [run(ANA, "2026-09-18", 100), run(BEN, "2026-09-18", 10)];
  const r = seasonRace([ANA, BEN], acts, SETTINGS, "2026-09-20")!;
  check("the leader is also projected to win", r.leadChanges, false);
}

console.log("\nnobody is dropped from the table");
{
  const acts = [run(ANA, "2026-08-04", 10)];
  const r = seasonRace([ANA, BEN, CAL], acts, SETTINGS, "2026-08-12")!;
  check("all three appear", r.rows.length, 3);
  check("the ones on nothing are still ranked", r.rows[2].points, 0);
  close("and they are the full gap behind", r.rows[2].behind, 100);
}

console.log("\nties share a place and nobody is asked to chase themselves");
{
  const acts = [run(ANA, "2026-08-04", 10), run(BEN, "2026-08-04", 10)];
  const r = seasonRace([ANA, BEN], acts, SETTINGS, "2026-08-12")!;
  check("both are first", [r.rows[0].rank, r.rows[1].rank], [1, 1]);
  check("margin is nothing", r.margin, 0);
  check("neither is chasing", [r.rows[0].needPerDay, r.rows[1].needPerDay], [null, null]);
}

console.log("\non the final day there is no per-day answer left to give");
{
  const acts = [run(BEN, "2026-09-29", 30), run(ANA, "2026-09-29", 20)];
  const r = seasonRace([ANA, BEN], acts, SETTINGS, "2026-09-30")!;
  const ana = r.rows.find((x) => x.athlete.id === "a")!;
  check("no days left", r.daysLeft, 0);
  check("so no rate can close it", ana.needPerDay, null);
  close("and the projection is simply where they stand", ana.projected, 200);
}

console.log(
  failures === 0 ? "\nAll race tests passed.\n" : `\n${failures} race test(s) FAILED.\n`,
);
if (failures > 0) process.exit(1);
