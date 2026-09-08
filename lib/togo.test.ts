import { toGo } from "./togo";
import { DEFAULT_SETTINGS, type Settings } from "./types";

/**
 * The quota translator.
 *
 * Every number here is one someone will act on — they will go and do the
 * distance it quotes — so the failure that matters is quoting SHORT. Three ways
 * that could happen and are guarded: rounding a distance down, quoting swim at
 * the open-water rate when the swim will be scored as a pool one, and reading
 * rates from the wrong day once a rate change has landed. Run with `npm test`.
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

// The live shape: base swim 20 / bike 1 / run 5 / gym 5, with run and swim
// re-rated from 31 Aug. Open water stays at 20 throughout, which is exactly
// why the pool/open-water distinction matters to this module.
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
  openWaterPerKm: 20,
  rateChanges: [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }],
};

const find = (list: ReturnType<typeof toGo>, sport: string) =>
  list.find((o) => o.sport === sport)!;

console.log("\n38 points short, on a day after the re-rate");
{
  // swim 15/km -> 2.533 -> 2.6   bike 1/km -> 38   run 4/km -> 9.5   gym 5 -> 8
  const list = toGo(38, SETTINGS, "2026-09-08", 5);
  check("swim rounds UP to the tenth", find(list, "swim").amount, 2.6);
  check("bike is the flat kilometres", find(list, "bike").amount, 38);
  check("run", find(list, "run").amount, 9.5);
  check("gym is whole workouts", find(list, "gym").amount, 8);
  check("and gym is marked as a count, not a distance", find(list, "gym").unit, "flat");
  check("every discipline is offered", list.length, 4);
}

console.log("\nthe swim quote is the POOL rate — the one you get by default");
{
  const after = toGo(30, SETTINGS, "2026-09-08", 5);
  // At 15/km a pool swim needs 2 km. At the open-water rate of 20 it would be
  // 1.5 km — and someone who swims 1.5 km in a pool finishes the week short.
  check("2 km at the pool rate", find(after, "swim").amount, 2);
  check("the quoted rate says so", find(after, "swim").rate, 15);
}

console.log("\nrates are read from the day, not from the code defaults");
{
  const before = toGo(60, SETTINGS, "2026-08-15", 5); // swim 20, run 5
  const after = toGo(60, SETTINGS, "2026-09-08", 5); // swim 15, run 4
  check("swim was cheaper before the change", find(before, "swim").amount, 3);
  check("and dearer after it", find(after, "swim").amount, 4);
  check("run was cheaper before", find(before, "run").amount, 12);
  check("and dearer after", find(after, "run").amount, 15);
  check("bike was untouched by the change", find(before, "bike").amount, find(after, "bike").amount);
}

console.log("\nrounding never quotes short");
{
  // 1 point at 15/km is 0.0667 km. Rounding to a tenth the ordinary way gives
  // 0.1, which happens to be enough — but 0.34 km at 3 pts must not become 0.3.
  const list = toGo(5, SETTINGS, "2026-09-08", 5);
  const swim = find(list, "swim");
  check("0.334 km becomes 0.4, not 0.3", swim.amount, 0.4);
  check("and the quote does cover the gap", swim.amount * swim.rate >= 5, true);
}

console.log("\nthe gym answer knows about the daily cap");
{
  // 100 points at 5/workout is 20 workouts. The cap is two a day, so with five
  // days left the most that can score is ten — the answer is arithmetic, not a
  // plan, and has to say so.
  const tight = toGo(100, SETTINGS, "2026-09-08", 5);
  check("twenty workouts", find(tight, "gym").amount, 20);
  check("flagged as beyond the cap", find(tight, "gym").beyondCap, true);

  const roomy = toGo(20, SETTINGS, "2026-09-08", 5); // 4 workouts, cap allows 10
  check("a reachable answer is not flagged", find(roomy, "gym").beyondCap, false);
}

console.log("\nnothing to say when there is nothing to do");
{
  check("already through", toGo(0, SETTINGS, "2026-09-08", 5), []);
  check("or past it", toGo(-12, SETTINGS, "2026-09-08", 5), []);
}

console.log("\na discipline that cannot close the gap is not offered");
{
  const noSwim: Settings = {
    ...SETTINGS,
    multipliers: { ...SETTINGS.multipliers, swim: 0 },
    rateChanges: [],
  };
  const list = toGo(38, noSwim, "2026-08-15", 5);
  check("swim is dropped rather than shown as infinity", list.some((o) => o.sport === "swim"), false);
  check("the rest still answer", list.length, 3);
}

console.log(
  failures === 0 ? "\nAll to-go tests passed.\n" : `\n${failures} to-go test(s) FAILED.\n`,
);
if (failures > 0) process.exit(1);
