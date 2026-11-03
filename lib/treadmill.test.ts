import { TREADMILL, pointsFor } from "./scoring";
import { isTreadmill } from "./strava";
import { DEFAULT_SETTINGS } from "./types";
import type { Settings } from "./types";
import type { DayKey } from "./dates";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

// The live shape: run 4/km since 31 Aug, nothing touching run after that.
const S: Settings = { ...DEFAULT_SETTINGS, rateChanges: [{ from: "2026-08-31", multipliers: { run: 4 } }] };
const day = (d: string) => d as DayKey;

console.log("\nonly a treadmill run gets the treadmill rate");
{
  check("10 km on the treadmill from 2 Nov", pointsFor(10, "run", S, day("2026-11-02"), null, true), 10 * TREADMILL.perKm);
  check("10 km outside the same day", pointsFor(10, "run", S, day("2026-11-02"), null, false), 40);
  check("unknown counts as outside", pointsFor(10, "run", S, day("2026-11-05"), null, null), 40);
  check("a treadmill run before the rule keeps its old score",
    pointsFor(10, "run", S, day("2026-11-01"), null, true), 40);
  check("the flag means nothing on a ride", pointsFor(10, "bike", S, day("2026-11-03"), null, true), pointsFor(10, "bike", S, day("2026-11-03")));
}

console.log("\nStrava tells us when it knows");
{
  check("a VirtualRun is a treadmill run", isTreadmill({ id: 1, sport_type: "VirtualRun" }, "run"), true);
  check("an indoor run is too", isTreadmill({ id: 1, sport_type: "Run", trainer: true }, "run"), true);
  check("a run with GPS was outside", isTreadmill({ id: 1, sport_type: "Run", start_latlng: [45.5, -73.6] }, "run"), false);
  check("a recorded run with no map was indoors",
    isTreadmill({ id: 1, sport_type: "Run", start_latlng: [] as unknown as [number, number], map: { summary_polyline: "" } }, "run"), true);
  check("a route without a start fix was still outside",
    isTreadmill({ id: 1, sport_type: "Run", map: { summary_polyline: "abc" } }, "run"), false);
  check("a run typed into Strava by hand is unknown",
    isTreadmill({ id: 1, sport_type: "Run", manual: true }, "run"), null);
  check("a swim is never a treadmill run", isTreadmill({ id: 1, sport_type: "Swim", trainer: true }, "swim"), null);
}

if (failed) {
  console.error(`\n${failed} failing.`);
  process.exit(1);
}
console.log("\nAll treadmill tests passed.");
