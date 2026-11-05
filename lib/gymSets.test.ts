import { GYM_SETS, activityPoints, standingsForRange, unscoredGymIds } from "./scoring";
import { setsFromDescription } from "./gymSets";
import { toGo } from "./togo";
import { DEFAULT_SETTINGS, type Activity, type Settings } from "./types";
import type { DayKey } from "./dates";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

// The live gym rate before the change: 5 per workout.
const S: Settings = { ...DEFAULT_SETTINGS, multipliers: { swim: 20, bike: 1, run: 5, gym: 5 }, rateChanges: [] };
let n = 0;
function gym(day: string, sets: number | null, athleteId = "a"): Activity {
  n++;
  return {
    id: `g${n}`, athleteId, sport: "gym", km: 1, occurredOn: day, note: null, source: "strava",
    points: null, elevationM: null, movingSeconds: null, localHour: 12, openWater: null, sets,
    createdAt: `2026-11-0${(n % 9) + 1}T10:00:0${n % 10}Z`,
  };
}

console.log("\ngym scores by the set from the change, flat before it");
{
  check("the change is today, 5 Nov", GYM_SETS.from, "2026-11-05");
  check("12 sets on 5 Nov is 12", activityPoints(gym("2026-11-05", 12), S), 12);
  check("1 set is 1", activityPoints(gym("2026-11-06", 1), S), 1);
  check("50 sets is 50", activityPoints(gym("2026-11-06", 50), S), 50);
  check("unknown sets score 0", activityPoints(gym("2026-11-05", null), S), 0);
  check("a workout the day before keeps its flat 5", activityPoints(gym("2026-11-04", null), S), 5);
  check("sets on an old workout don't rescore it", activityPoints(gym("2026-11-04", 30), S), 5);
}

console.log("\nthe daily cap is gone from the change, kept before it");
{
  const after = [gym("2026-11-06", 4), gym("2026-11-06", 5), gym("2026-11-06", 6)];
  check("three sessions on 6 Nov all score", unscoredGymIds(after).size, 0);
  const st = standingsForRange([{ id: "a", name: "A" } as never], after, S, ["2026-11-06", "2026-11-06"]);
  check("and add up to their sets", st[0].points, 15);
  const before = [gym("2026-11-03", null), gym("2026-11-03", null), gym("2026-11-03", null)];
  check("the third on 3 Nov is still capped", unscoredGymIds(before).size, 1);
}

console.log("\nsets read off a Strava description");
{
  check("Ryan's 27 Oct upper day",
    setsFromDescription("Lat pulldown 2 sets\nSmith incline bench 2 sets\nDumbbell biceps curl 2 sets\nTriceps pushdown 2 sets\nDumbbell lateral raise 2 sets\n\nMuskoka #71"), 10);
  check("em dashes and a single set",
    setsFromDescription("Lat pulldown — 2 sets\nRope triceps extension — 1 set\nMachine preacher curl — 1 set"), 4);
  check("sets x reps", setsFromDescription("Bench 3x8\nSquat 5 × 5"), 8);
  check("nothing named is unknown, not zero", setsFromDescription("Muskoka #80"), null);
  check("no description is unknown", setsFromDescription(null), null);
}

console.log("\nto go quotes sets, with no cap");
{
  const opts = toGo(30, S, "2026-11-06" as DayKey, 1);
  const g = opts.find((o) => o.sport === "gym");
  check("30 short is 30 sets", [g?.amount, g?.unit, g?.beyondCap ?? false], [30, "sets", false]);
  const old = toGo(30, S, "2026-11-03" as DayKey, 1).find((o) => o.sport === "gym");
  check("before the change it was workouts", [old?.amount, old?.unit], [6, "flat"]);
}

if (failed) {
  console.error(`\n${failed} failing.`);
  process.exit(1);
}
console.log("\nAll gym set tests passed.");
