import { bikeBlockedReason, recordsFor } from "./pbs";
import type { ActivityEfforts } from "./types";
import {
  bestPowerForWindow,
  bestTimeForDistance,
  effortsFor,
  formatDuration,
  formatPace,
} from "./efforts";

/**
 * Personal bests are computed from raw streams, so an error here doesn't crash —
 * it quietly publishes a record nobody set. Every case below is a stream written
 * by hand where the right answer is known from arithmetic rather than from
 * running the code. Run with `npm test`.
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
/** Floating-point maths needs a tolerance, not equality. */
function near(label: string, actual: number | null, expected: number, tol = 0.01) {
  if (actual !== null && Math.abs(actual - expected) <= tol) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ~${expected}\n         actual   ${actual}`);
  }
}

/** A steady effort: `n` samples one second apart at a constant speed. */
function steady(n: number, metresPerSecond: number) {
  const time: number[] = [];
  const distance: number[] = [];
  for (let k = 0; k < n; k++) {
    time.push(k);
    distance.push(k * metresPerSecond);
  }
  return { time, distance };
}

console.log("\nbestTimeForDistance — a steady runner");
{
  // 5 m/s for 200 s = 1000 m. Every answer here is just distance / speed.
  const { time, distance } = steady(201, 5);
  near("100 m at 5 m/s is 20 s", bestTimeForDistance(time, distance, 100), 20);
  near("1 km at 5 m/s is 200 s", bestTimeForDistance(time, distance, 1000), 200);
  check("a distance never covered has no time",
    bestTimeForDistance(time, distance, 5000), null);
}

console.log("\nbestTimeForDistance — the fastest stretch, not the first");
{
  // 500 m easy at 4 m/s, then 500 m hard at 8 m/s. The best 400 m must come out
  // of the second half: 50 s, not the 100 s the opening 400 m took.
  const time: number[] = [];
  const distance: number[] = [];
  let d = 0;
  for (let k = 0; k <= 125; k++) { time.push(k); distance.push(d); d += k < 125 ? 4 : 0; }
  const base = distance[125];
  for (let k = 1; k <= 63; k++) { time.push(125 + k); distance.push(base + k * 8); }
  near("it finds the fast 400 m, not the slow one",
    bestTimeForDistance(time, distance, 400), 50, 0.5);
}

console.log("\nbestTimeForDistance — the start edge is interpolated");
{
  // Sampled every 5 s at 6 m/s, so 30 m a sample and 100 m never lands on one.
  // The true answer is 100/6 = 16.67 s; taking the first sample past the line
  // would say 20 s and hand out a best three seconds slower than the run.
  const time: number[] = [];
  const distance: number[] = [];
  for (let k = 0; k <= 40; k++) { time.push(k * 5); distance.push(k * 30); }
  near("100 m at 6 m/s is 16.67 s, not the 20 s of the next sample",
    bestTimeForDistance(time, distance, 100), 100 / 6);
  near("400 m at 6 m/s is 66.67 s", bestTimeForDistance(time, distance, 400), 400 / 6);
}

console.log("\nbestTimeForDistance — a pause makes an effort SLOW, not absent");
{
  // 250 m, stop for a minute, another 250 m.
  //
  // This used to assert that 400 m and 500 m produced nothing, on the theory
  // that a pause should break the effort. That was wrong, and it cost a real
  // record: a gap only ever ADDS elapsed seconds, so a window spanning one is
  // slow and can never be a false best — while refusing it means a long run
  // whose stream has any gap yields no long-distance record at all.
  const time: number[] = [];
  const distance: number[] = [];
  for (let k = 0; k <= 50; k++) { time.push(k); distance.push(k * 5); }
  for (let k = 0; k <= 50; k++) { time.push(110 + k); distance.push(250 + k * 5); }
  near("250 m inside one stretch is still 50 s", bestTimeForDistance(time, distance, 250), 50);
  // 400 m starting at the 100 m mark and ending at the finish: 20 s -> 160 s.
  near("400 m across the pause is found, and carries the pause",
    bestTimeForDistance(time, distance, 400), 140);
  near("the full 500 m likewise", bestTimeForDistance(time, distance, 500), 160);
}

console.log("\nbestTimeForDistance — a thinned stream must not lose the distance");
{
  // THE PRODUCTION BUG. Strava thins the streams of long activities, so a half
  // marathon arrives with gaps in it. Splitting on those gaps broke the run into
  // pieces, none of which covered 21.1 km, and the record silently vanished — a
  // 21.15 km run produced no half-marathon best while a shorter 21.11 km one did.
  const time: number[] = [];
  const distance: number[] = [];
  let t = 0, d = 0;
  for (let k = 0; k < 7100; k++) {
    // A 20-second thinning every twenty minutes, still at running pace.
    const step = k > 0 && k % 1200 === 0 ? 20 : 1;
    t += step; d += 3 * step;
    time.push(t); distance.push(d);
  }
  check("the run really is past a half marathon", distance[distance.length - 1] > 21097.5, true);
  const hm = bestTimeForDistance(time, distance, 21097.5);
  check("and the half marathon best exists", hm !== null, true);
  near("at 3 m/s it is ~7032 s", hm!, 21097.5 / 3, 25);
  check("the 15 km best exists too", bestTimeForDistance(time, distance, 15000) !== null, true);
}

console.log("\nbestTimeForDistance — a GPS teleport is excluded");
{
  // A reacquisition drops 60 m into a single second: 60 m/s, five times faster
  // than a human sprints. A window containing it must not become the record.
  const time: number[] = [];
  const distance: number[] = [];
  for (let k = 0; k <= 200; k++) { time.push(k); distance.push(k * 3); }
  // Teleport at t=100, then carry on.
  for (let k = 101; k <= 200; k++) distance[k] += 60;
  const best = bestTimeForDistance(time, distance, 100);
  // Clean running is 3 m/s, so 100 m takes ~33.3 s. Anything far under that came
  // from the jump.
  check("the teleport does not set the record", best !== null && best > 30, true);
  near("it reads as honest running pace", best!, 100 / 3, 1);
}

console.log("\nbestPowerForWindow — a steady ride");
{
  const time = Array.from({ length: 101 }, (_, k) => k);
  const watts = Array.from({ length: 101 }, () => 200);
  near("60 s of 200 W averages 200 W", bestPowerForWindow(time, watts, 60), 200);
  near("15 s of 200 W averages 200 W", bestPowerForWindow(time, watts, 15), 200);
  check("a window longer than the ride has no answer",
    bestPowerForWindow(time, watts, 300), null);
}

console.log("\nbestPowerForWindow — a spike inside an easy ride");
{
  // 100 W throughout, except 30 s at 600 W. Watts hold from each sample to the
  // next, so the spike is exactly 30 s of 600 W.
  const time = Array.from({ length: 201 }, (_, k) => k);
  const watts = time.map((t) => (t >= 100 && t < 130 ? 600 : 100));
  near("15 s sits inside the spike: 600 W", bestPowerForWindow(time, watts, 15), 600);
  near("30 s is the whole spike: 600 W", bestPowerForWindow(time, watts, 30), 600);
  // A 60 s window can hold the 30 s spike plus 30 s of easy riding:
  // (30*600 + 30*100) / 60 = 350.
  near("60 s dilutes it to 350 W", bestPowerForWindow(time, watts, 60), 350);
}

console.log("\neffortsFor — what gets stored");
{
  const { time, distance } = steady(1201, 5); // 6 km at 5 m/s
  const runKeys = Object.keys(effortsFor("run", { time, distance }));
  check("a 6 km run yields bests up to 5 km", runKeys.includes("run:5000"), true);
  check("and none for 10 km", runKeys.includes("run:10000"), false);
  // 100 m was dropped: inside a long run it measures jogging, not a sprint.
  check("100 m is not on the run ladder", runKeys.includes("run:100"), false);
  check("400 m is where it starts", runKeys.includes("run:400"), true);
  near("the 5 km best is 1000 s",
    effortsFor("run", { time, distance })["run:5000"], 1000, 0.5);

  // Swim targets are the swim list, not the run one.
  const swim = effortsFor("swim", steady(401, 1));
  check("a 400 m swim yields 100 m and 250 m",
    Object.keys(swim).sort(), ["swim:100", "swim:250"]);

  // THE ONE THAT MATTERS: no power meter, no power curve. Estimating watts from
  // speed would invent numbers nobody rode for, and these are meant to be records.
  const noPower = effortsFor("bike", { time, distance });
  check("a ride with no watts stream stores nothing", noPower, {});
  const withPower = effortsFor("bike", {
    time: Array.from({ length: 121 }, (_, k) => k),
    watts: Array.from({ length: 121 }, () => 250),
  });
  check("a ride with watts stores the windows it covered",
    Object.keys(withPower).sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1])),
    ["bike:15", "bike:30", "bike:60"]);
  check("gym has no bests at all", effortsFor("gym", { time, distance }), {});
}

console.log("\nformatting");
{
  check("sub-minute keeps a tenth", formatDuration(58.44), "58.4s");
  check("minutes and seconds", formatDuration(599.6), "10:00");
  check("hours roll up", formatDuration(3852), "1:04:12");
  check("a marathon reads as hours", formatDuration(11400), "3:10:00");
  check("run pace is per km", formatPace(1000, 5000, "run"), "3:20/km");
  check("swim pace is per 100 m", formatPace(90, 100, "swim"), "1:30/100m");
  // 59.6 s rounds to 60 and must carry into the minute, not print "4:60".
  check("a rounded 60 carries", formatPace(239.6, 1000, "run"), "4:00/km");
}

const SEASON = "2026-08-03";
function eff(
  stravaId: number, athleteId: string, sport: "run" | "swim" | "bike",
  occurredOn: string, bests: Record<string, number>, weightKg: number | null = null,
): ActivityEfforts {
  return { stravaId, athleteId, sport, occurredOn, bests, weightKg };
}

console.log("\nrecordsFor — the league's book");
{
  const efforts = [
    eff(1, "ryan", "run", "2026-08-10", { "run:5000": 1200 }),
    eff(2, "jona", "run", "2026-08-12", { "run:5000": 1150 }),
    eff(3, "ryan", "run", "2026-08-20", { "run:5000": 1100 }), // Ryan improves
  ];
  const rows = recordsFor("run", efforts, SEASON);
  const five = rows.find((r) => r.key === "run:5000")!;
  check("the fastest is first", five.entries[0].athleteId, "ryan");
  check("and it is their BEST, not their latest", five.entries[0].value, 1100);
  // One entry per athlete, or a strong runner fills the row with their own five
  // fastest and pushes everyone else off it.
  check("one entry per athlete", five.entries.length, 2);
  check("the runner-up is there too", five.entries[1].athleteId, "jona");

  const marathon = rows.find((r) => r.key === "run:42195")!;
  check("a distance nobody has covered is empty", marathon.entries, []);
  check("the ladder is the full list of targets", rows.length, 10);
}

console.log("\nrecordsFor — only this league's sessions count");
{
  // A run from before kickoff is somebody's personal best, but it is not one of
  // AmaComp's records.
  const efforts = [
    eff(1, "ryan", "run", "2026-07-30", { "run:1000": 180 }),
    eff(2, "jona", "run", "2026-08-10", { "run:1000": 240 }),
  ];
  const km = recordsFor("run", efforts, SEASON).find((r) => r.key === "run:1000")!;
  check("the pre-kickoff run is excluded", km.entries.map((e) => e.athleteId), ["jona"]);
  check("so the slower in-season run holds it", km.entries[0].value, 240);
}

console.log("\nrecordsFor — cycling is ranked on W/kg, not watts");
{
  // The heavier rider pushes more watts and the lighter one wins the record:
  // 300/60 = 5.0 beats 350/85 = 4.12. Ranking on raw watts would invert this.
  const efforts = [
    eff(1, "heavy", "bike", "2026-08-10", { "bike:300": 350 }, 85),
    eff(2, "light", "bike", "2026-08-11", { "bike:300": 300 }, 60),
  ];
  const row = recordsFor("bike", efforts, SEASON).find((r) => r.key === "bike:300")!;
  check("higher W/kg wins", row.entries[0].athleteId, "light");
  near("and the value is watts over kilos", row.entries[0].value, 5);
  check("the raw watts are kept for display", row.entries[0].raw, 300);
  check("the heavier rider is second", row.entries[1].athleteId, "heavy");
}

console.log("\nrecordsFor — a null pinned weight falls back to the athlete's current one");
{
  // THE PRODUCTION CASE. Weight arrives from the same Strava sync that extracts
  // the efforts, so the first pass has nothing to pin: all 103 live rows stored
  // null, and the cycling book could never show anything however many people
  // filled a weight in afterwards. Resolving at read time repairs them.
  const efforts = [eff(1, "ryan", "bike", "2026-08-10", { "bike:300": 300 }, null)];
  const noFallback = recordsFor("bike", efforts, SEASON).find((r) => r.key === "bike:300")!;
  check("with no weight anywhere the row stays empty", noFallback.entries.length, 0);

  const weights = new Map([["ryan", 75]]);
  const row = recordsFor("bike", efforts, SEASON, weights).find((r) => r.key === "bike:300")!;
  check("the current weight rescues the record", row.entries.length, 1);
  near("and it is watts over that weight", row.entries[0].value, 4);
  check("the weight used is reported", row.entries[0].weightKg, 75);
  // The explanation must agree with the book, or it says "add a weight" to
  // someone who already has one.
  check("and the tab stops claiming a weight is missing",
    bikeBlockedReason(efforts, SEASON, weights), null);
  check("while still saying so when none exists",
    bikeBlockedReason(efforts, SEASON), "no-weight");

  // A pinned weight still wins — a record stays true to the day it was set.
  const pinned = [eff(2, "ryan", "bike", "2026-08-10", { "bike:300": 300 }, 60)];
  near("a pinned weight is preferred over today's",
    recordsFor("bike", pinned, SEASON, weights).find((r) => r.key === "bike:300")!.entries[0].value, 5);
}

console.log("\nrecordsFor — a ride with no weight can't be ranked");
{
  const efforts = [eff(1, "ryan", "bike", "2026-08-10", { "bike:60": 400 }, null)];
  const row = recordsFor("bike", efforts, SEASON).find((r) => r.key === "bike:60")!;
  // Ranking it on raw watts would put a heavier rider ahead on a number that
  // isn't the one being compared, so it sits out until a weight is filled in.
  check("no weight, no entry", row.entries, []);
  check("and the tab explains why", bikeBlockedReason(efforts, SEASON), "no-weight");
}

console.log("\nbikeBlockedReason — telling the two empty cases apart");
{
  check("no rides at all is not a blocked state", bikeBlockedReason([], SEASON), null);
  check("rides but no power stream",
    bikeBlockedReason([eff(1, "a", "bike", "2026-08-10", {})], SEASON), "no-power");
  check("power and weight both present is fine",
    bikeBlockedReason([eff(1, "a", "bike", "2026-08-10", { "bike:60": 300 }, 70)], SEASON),
    null);
}

console.log("\nrecordsFor — swim uses the swim ladder");
{
  const rows = recordsFor("swim", [eff(1, "a", "swim", "2026-08-10", { "swim:1500": 1500 })], SEASON);
  check("seven swim targets", rows.length, 7);
  check("1.5 km is one of them", rows.some((r) => r.key === "swim:1500"), true);
  check("and it is held", rows.find((r) => r.key === "swim:1500")!.entries.length, 1);
}

console.log(failures === 0 ? "\nAll effort tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
