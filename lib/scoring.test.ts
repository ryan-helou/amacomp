import { activityPoints, goalFor, ratesOn, unscoredGymIds, standingsForRange, totalPoints } from "./scoring";
import { getStore } from "./db";
import { ANNOUNCE_HOUR, announcementIsDue, rateAnnouncementFor } from "./announce";
import { addDays, daysBetween, periodRange } from "./dates";
import { seasonByNumber, seasonChampions, seasonFor } from "./season";
import { hallOfFame } from "./records";
import { DEFAULT_SETTINGS, type Activity, type Athlete, type Settings } from "./types";

/**
 * Scoring rules are the one part of this app where a bug costs someone a real
 * forfeit, so they get a regression test. Run with `npm test`.
 *
 * The gym cap is the important one: gym scores flat per workout, so without a
 * cap N taps = N × 30 points and one afternoon beats the weekly quota twice over.
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

const S = DEFAULT_SETTINGS; // gym 30/workout, run 5/km

function gym(id: string, athleteId: string, day: string, createdAt: string): Activity {
  return { id, athleteId, sport: "gym", km: 1, occurredOn: day, note: null, source: "manual", points: null, elevationM: null, openWater: null, createdAt };
}
function run(id: string, athleteId: string, day: string, km: number): Activity {
  return { id, athleteId, sport: "run", km, occurredOn: day, note: null, source: "strava", points: null, elevationM: null, openWater: null, createdAt: "2026-08-10T10:00:00Z" };
}
function grant(id: string, athleteId: string, day: string, points: number): Activity {
  return { id, athleteId, sport: "run", km: 0, occurredOn: day, note: null, source: "admin", points, elevationM: null, openWater: null, createdAt: "2026-08-11T10:00:00Z" };
}
function excuse(id: string, athleteId: string, day: string, points: number): Activity {
  return { id, athleteId, sport: "run", km: 0, occurredOn: day, note: null, source: "excuse", points, elevationM: null, openWater: null, createdAt: "2026-08-11T10:00:00Z" };
}

const ath = (id: string, name: string): Athlete => ({
  id, name, weightKg: null, avatarColor: null, avatarGlyph: null, avatarUrl: null,
});

/** A ride with a known ascent. `elevationM: null` elsewhere means "unknown". */
function ride(id: string, athleteId: string, day: string, km: number, elevationM: number | null): Activity {
  return { id, athleteId, sport: "bike", km, occurredOn: day, note: null, source: "strava", points: null, elevationM, openWater: null, createdAt: "2026-08-10T10:00:00Z" };
}

console.log("\nclimb points");
{
  // Defaults: bike 1 pt/km and 1 pt per 100 m; swim/run/gym climb nothing.
  check("flat 20 km ride is distance only", activityPoints(ride("r1", "a", "2026-08-18", 20, 0), S), 20);
  check("500 m of ascent adds 5", activityPoints(ride("r2", "a", "2026-08-18", 20, 500), S), 25);
  check("climb is proportional, not stepped", activityPoints(ride("r3", "a", "2026-08-18", 0.001, 250), S), 2.5 + 0.001);
  // The distinction the column exists for: unknown must not score as flat.
  check("unknown ascent scores no climb", activityPoints(ride("r4", "a", "2026-08-18", 20, null), S), 20);
  // Running counts ascent as DISTANCE: 800 m up is 8 km, and on 18 Aug a km was
  // worth 5, so the climb adds 40 on top of the 50 for the 10 km itself.
  check("a run's ascent counts as kilometres", activityPoints(
    { ...run("r5", "a", "2026-08-18", 10), elevationM: 800 }, S), 90);
  check("negative ascent is ignored, never subtracted", activityPoints(ride("r6", "a", "2026-08-18", 20, -300), S), 20);
  // `elevationPer100m.run` no longer does anything — running goes through the
  // distance rule instead, so setting it must NOT double-count.
  const climbyRun = { ...S, elevationPer100m: { ...S.elevationPer100m, run: 2 } };
  check("the old per-100m run rate is ignored, not added", activityPoints(
    { ...run("r7", "a", "2026-08-18", 10), elevationM: 300 }, climbyRun), 50 + 15);
  // Turning the rule off entirely leaves a run scoring on distance alone.
  const noAscent = { ...S, runAscentMetresPerKm: 0 };
  check("0 turns the run ascent rule off", activityPoints(
    { ...run("r7b", "a", "2026-08-18", 10), elevationM: 300 }, noAscent), 50);
  // Grants carry flat points and have no session behind them.
  check("a grant never picks up climb points", activityPoints(
    { ...grant("r8", "a", "2026-08-18", 40), elevationM: 900 }, S), 40);
}

console.log("\ndated rate changes — the past does not move");
{
  // Mirrors the LIVE production settings row (swim 20 / bike 1 / run 5 / gym 5,
  // climb 1 per 100 m on the bike) rather than DEFAULT_SETTINGS, whose base
  // numbers are stale. Ryan's change: run 4/km and swim 15/km from Mon 31 Aug.
  const PROD: Settings = {
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    rateChanges: [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }],
    openWaterPerKm: 20,
    runAscentMetresPerKm: 100,
    weeklyGoal: 100,
    seasonStart: "2026-08-03",
    forfeit: "Run a marathon",
  };

  check("before the change, run is still 5/km", ratesOn("2026-08-30", PROD).multipliers.run, 5);
  check("before the change, swim is still 20/km", ratesOn("2026-08-30", PROD).multipliers.swim, 20);
  check("on the day itself, run is 4/km (from is inclusive)",
    ratesOn("2026-08-31", PROD).multipliers.run, 4);
  check("on the day itself, swim is 15/km", ratesOn("2026-08-31", PROD).multipliers.swim, 15);
  check("after the change, run stays 4/km", ratesOn("2026-09-14", PROD).multipliers.run, 4);

  // A partial change must not disturb the sports it doesn't name. Writing all
  // four rates into the entry would have reset bike and gym to stale numbers.
  check("bike is untouched by the change", ratesOn("2026-09-14", PROD).multipliers.bike, 1);
  check("gym is untouched by the change", ratesOn("2026-09-14", PROD).multipliers.gym, 5);
  check("the bike climb rate is untouched",
    ratesOn("2026-09-14", PROD).elevationPer100m.bike, 1);

  // The headline: the SAME session scores differently either side of the line,
  // and a session already logged keeps exactly what it earned.
  check("10 km run on Sun 30 Aug scores 50",
    activityPoints(run("d1", "a", "2026-08-30", 10), PROD), 50);
  check("10 km run on Mon 31 Aug scores 40",
    activityPoints(run("d2", "a", "2026-08-31", 10), PROD), 40);
  check("2 km swim on Sun 30 Aug scores 40",
    activityPoints({ ...run("d3", "a", "2026-08-30", 2), sport: "swim" as const }, PROD), 40);
  check("2 km swim on Mon 31 Aug scores 30",
    activityPoints({ ...run("d4", "a", "2026-08-31", 2), sport: "swim" as const }, PROD), 30);
  // A ride is unaffected either side, climb included.
  check("a 20 km ride with 500 m up scores 25 on both sides", [
    activityPoints(ride("d5", "a", "2026-08-30", 20, 500), PROD),
    activityPoints(ride("d6", "a", "2026-08-31", 20, 500), PROD),
  ], [25, 25]);

  // Because the change lands on a Monday, no single week straddles two eras —
  // which is exactly why "the week of the 31st" is a clean place to move a rate.
  const oldWeek = standingsForRange([ath("a", "A")],
    [run("w1", "a", "2026-08-24", 10), run("w2", "a", "2026-08-30", 10)],
    PROD, periodRange("week", "2026-08-26"));
  check("the week before scores entirely at 5/km", oldWeek[0].points, 100);
  const newWeek = standingsForRange([ath("a", "A")],
    [run("w3", "a", "2026-08-31", 10), run("w4", "a", "2026-09-06", 10)],
    PROD, periodRange("week", "2026-09-02"));
  check("the week after scores entirely at 4/km", newWeek[0].points, 80);
}

console.log("\ndated rate changes — stacking and hygiene");
{
  const base: Settings = {
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    rateChanges: [
      { from: "2026-08-31", multipliers: { run: 4 } },
      { from: "2026-10-01", multipliers: { run: 3 } },
    ],
    openWaterPerKm: 20, runAscentMetresPerKm: 100, weeklyGoal: 100, seasonStart: "2026-08-03", forfeit: "x",
  };
  check("between the two changes, the first one holds", ratesOn("2026-09-15", base).multipliers.run, 4);
  check("after the second, the newest wins", ratesOn("2026-10-02", base).multipliers.run, 3);
  check("before any change, the base holds", ratesOn("2026-08-01", base).multipliers.run, 5);

  // No changes at all must behave exactly like the old single-rate model.
  const flat: Settings = { ...base, rateChanges: [] };
  check("no changes -> base rates everywhere", [
    ratesOn("2020-01-01", flat).multipliers.run,
    ratesOn("2099-01-01", flat).multipliers.run,
  ], [5, 5]);
}

console.log("\nthe scoring-change announcement");
{
  const PROD: Settings = {
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    rateChanges: [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }],
    openWaterPerKm: 20, runAscentMetresPerKm: 100, weeklyGoal: 100, seasonStart: "2026-08-03", forfeit: "Run a marathon",
  };

  const a = rateAnnouncementFor("2026-08-31", PROD);
  check("it announces the change that started", a?.from, "2026-08-31");
  // Diffed against the day before, so it can say "5 -> 4" rather than just "4",
  // and so sports the change didn't name produce no row at all.
  check("it lists exactly what moved", a?.moves, [
    { sport: "swim", before: 20, after: 15, climb: false },
    { sport: "run", before: 5, after: 4, climb: false },
  ]);
  check("nothing to announce before it starts", rateAnnouncementFor("2026-08-30", PROD), null);
  check("it stops being news after a week",
    rateAnnouncementFor("2026-09-08", PROD), null);
  check("still news six days later", rateAnnouncementFor("2026-09-06", PROD)?.from, "2026-08-31");

  // A change that restates the rates already in force moves nothing, so there is
  // nothing to announce — this is what stops a no-op admin save from popping a
  // full-screen card on everyone's phone.
  const noop: Settings = { ...PROD, rateChanges: [{ from: "2026-08-31", multipliers: { run: 5 } }] };
  check("a change that restates a rate announces nothing",
    rateAnnouncementFor("2026-08-31", noop), null);

  // The 6 AM gate. Before the 3 AM rollover a session still logs into yesterday
  // at yesterday's rates, so announcing at 1 AM would be actively misleading.
  check("ANNOUNCE_HOUR is 6", ANNOUNCE_HOUR, 6);
  const due = (day: string, hour: number) => announcementIsDue(a!, day, hour);
  check("not due at 1 AM on the day it starts", due("2026-08-31", 1), false);
  check("not due at 5 AM", due("2026-08-31", 5), false);
  check("due at 6 AM sharp", due("2026-08-31", 6), true);
  check("due at 9 AM", due("2026-08-31", 9), true);
  // Someone who was away should still be told, whatever time they open it.
  check("due at any hour the next day", due("2026-09-01", 0), true);
  check("never due before the day itself", due("2026-08-30", 23), false);

  // Climb rates get their own row rather than being folded into the sport.
  const climb: Settings = {
    ...PROD,
    rateChanges: [{ from: "2026-08-31", elevationPer100m: { bike: 2 } }],
  };
  check("a climbing change is announced as a climbing row",
    rateAnnouncementFor("2026-08-31", climb)?.moves,
    [{ sport: "bike", before: 1, after: 2, climb: true }]);
}

console.log("\nrunning ascent counts as distance");
{
  const PROD: Settings = {
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    rateChanges: [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }],
    openWaterPerKm: 20, runAscentMetresPerKm: 100,
    weeklyGoal: 100, seasonStart: "2026-08-03", forfeit: "x",
  };
  const hilly = (day: string, km: number, m: number): Activity => ({
    id: "r", athleteId: "a", sport: "run", km, occurredOn: day, note: null,
    source: "strava", points: null, elevationM: m, openWater: null,
    createdAt: "2026-09-01T10:00:00Z",
  });

  // Ryan's own arithmetic: at 4 pts/km, a point per 25 m of ascent.
  check("25 m of ascent is 1 point at 4/km",
    activityPoints(hilly("2026-09-01", 0, 25), PROD), 1);
  check("100 m of ascent is a kilometre, so 4 points",
    activityPoints(hilly("2026-09-01", 0, 100), PROD), 4);
  check("a 10 km run with 500 m up scores 40 + 20",
    activityPoints(hilly("2026-09-01", 10, 500), PROD), 60);

  // Retroactive by instruction, and because ascent is DISTANCE it scores at the
  // rate of its own day — 5/km before the 31st, 4/km after.
  check("the same climb before the rate cut is worth 5 a kilometre",
    activityPoints(hilly("2026-08-20", 0, 100), PROD), 5);

  // Unknown ascent stays worth nothing. Treating null as flat would be a claim.
  check("unknown ascent still scores no climb",
    activityPoints(hilly("2026-09-01", 10, null as unknown as number), PROD), 40);
  // Cycling is untouched by the run rule: still a flat point per 100 m.
  const ride: Activity = { ...hilly("2026-09-01", 20, 500), sport: "bike" };
  check("a ride still climbs at 1 per 100 m", activityPoints(ride, PROD), 25);
}

console.log("\nopen water swims");
{
  const PROD: Settings = {
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    rateChanges: [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }],
    openWaterPerKm: 20, runAscentMetresPerKm: 100, weeklyGoal: 100, seasonStart: "2026-08-03", forfeit: "x",
  };
  const swim = (day: string, km: number, open: boolean | null): Activity => ({
    id: "s", athleteId: "a", sport: "swim", km, occurredOn: day, note: null,
    source: "strava", points: null, elevationM: null, openWater: open,
    createdAt: "2026-08-10T10:00:00Z",
  });

  // The rule: open water is 20/km whatever the pool rate has done.
  check("open water after the rate cut is 20/km",
    activityPoints(swim("2026-09-05", 2, true), PROD), 40);
  check("a pool swim on the same day is 15/km",
    activityPoints(swim("2026-09-05", 2, false), PROD), 30);

  // Retroactive, and provably harmless: swim was 20/km league-wide until the
  // 31st, so an open water swim before then scored 20 either way. That is why
  // making this one rate retroactive costs nobody a point.
  check("open water before the cut is 20/km, as it always was",
    activityPoints(swim("2026-08-10", 1.556, true), PROD), 31.12);
  check("and a pool swim then was also 20/km",
    activityPoints(swim("2026-08-10", 1.556, false), PROD), 31.12);
  // Rounded: 1.262 x 20 lands on 25.240000000000002 in binary floating point.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  check("so reclassifying the past changes nothing", [
    r2(activityPoints(swim("2026-08-10", 1.262, true), PROD)),
    r2(activityPoints(swim("2026-08-10", 1.262, false), PROD)),
  ], [25.24, 25.24]);

  // UNKNOWN scores as a pool. A hand-logged swim from before the question was
  // asked might be either, and reading it as open water would hand out points
  // nobody claimed.
  check("unknown is scored as a pool, not guessed upward",
    activityPoints(swim("2026-09-05", 2, null), PROD), 30);

  // The flag is meaningless anywhere else and must never pay out.
  const openRun: Activity = { ...swim("2026-09-05", 10, true), sport: "run" };
  check("a run flagged open water still scores as a run",
    activityPoints(openRun, PROD), 40);

  // Open water is NOT dated, so a later rate change to swim leaves it alone.
  const cut: Settings = {
    ...PROD,
    rateChanges: [...PROD.rateChanges, { from: "2026-10-01", multipliers: { swim: 5 } }],
  };
  check("a later pool cut does not touch open water",
    activityPoints(swim("2026-10-02", 2, true), cut), 40);
  check("but the pool follows it", activityPoints(swim("2026-10-02", 2, false), cut), 10);
}

console.log("\nhall of fame rankings");
{
  const S2 = DEFAULT_SETTINGS;
  const acts = [
    run("h1", "ryan", "2026-08-10", 12),
    run("h2", "ryan", "2026-08-11", 8),
    run("h3", "jona", "2026-08-10", 15),
    run("h4", "alberto", "2026-08-12", 5),
    gym("h5", "jona", "2026-08-10", "2026-08-10T10:00:00Z"),
  ];
  const hall = hallOfFame(acts, S2);

  // THE INVARIANT: the headline holder is entries[0]. If these ever disagree the
  // record book is showing one name and ranking another.
  let mismatched = 0;
  for (const r of hall) {
    const top = r.entries[0] ?? null;
    if ((r.holderId ?? null) !== (top?.athleteId ?? null)) mismatched++;
    if (top && Math.abs(r.value - top.value) > 1e-9) mismatched++;
  }
  check("every headline matches the top of its own ranking", mismatched, 0);

  const longestRun = hall.find((r) => r.key === "run")!;
  check("longest run is held by the longest run", longestRun.holderId, "jona");
  check("and the ranking lists everyone who has one",
    longestRun.entries.map((e) => e.athleteId), ["jona", "ryan", "alberto"]);
  // One entry per athlete: Ryan ran twice and appears once, at his best.
  check("one entry per athlete, at their own best", longestRun.entries[1].value, 12);

  // A record nobody has set has no ranking rather than a phantom row.
  const swim = hall.find((r) => r.key === "swim")!;
  check("an unclaimed record has an empty ranking", swim.entries, []);
  check("and no holder", swim.holderId, null);
}

console.log("\nunscoredGymIds");
{
  // 3 gym in one day -> only the 3rd is dropped, and it's the LATEST one.
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T12:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T18:00:00Z"),
  ];
  check("3 same day -> drops the latest", [...unscoredGymIds(acts)], ["g3"]);
}
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T12:00:00Z"),
  ];
  check("2 same day -> none dropped", [...unscoredGymIds(acts)], []);
}
{
  // Input order must not matter — earliest createdAt always wins.
  const acts = [
    gym("g3", "a", "2026-08-10", "2026-08-10T18:00:00Z"),
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T12:00:00Z"),
  ];
  check("input order irrelevant", [...unscoredGymIds(acts)], ["g3"]);
}
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-11", "2026-08-11T08:00:00Z"),
    gym("g3", "a", "2026-08-12", "2026-08-12T08:00:00Z"),
  ];
  check("spread across days -> none dropped", [...unscoredGymIds(acts)], []);
}
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "b", "2026-08-10", "2026-08-10T09:00:00Z"),
    gym("g3", "c", "2026-08-10", "2026-08-10T10:00:00Z"),
  ];
  check("different athletes -> none dropped", [...unscoredGymIds(acts)], []);
}
{
  check("runs are never capped", [...unscoredGymIds([
    run("r1", "a", "2026-08-10", 10),
    run("r2", "a", "2026-08-10", 10),
    run("r3", "a", "2026-08-10", 10),
    run("r4", "a", "2026-08-10", 10),
  ])], []);
}

console.log("\nstandingsForRange applies the cap");
{
  const athletes = [ath("a", "Ann"), ath("b", "Bob")];
  // Ann spams 5 gym in a day (would be 150 pts uncapped); Bob runs 10km = 50 pts.
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T01:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T02:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T03:00:00Z"),
    gym("g4", "a", "2026-08-10", "2026-08-10T04:00:00Z"),
    gym("g5", "a", "2026-08-10", "2026-08-10T05:00:00Z"),
    run("r1", "b", "2026-08-10", 10),
  ];
  const st = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const ann = st.find((s) => s.athlete.id === "a")!;
  const bob = st.find((s) => s.athlete.id === "b")!;
  check("gym spam capped at 2x30=60", ann.points, 60);
  check("bob 10km run = 50", bob.points, 50);
  check("all 5 still counted as sessions", ann.sessions, 5);
  check("3 marked unscored", ann.unscoredSessions, 3);
  check("ann still leads 60 > 50", ann.rank, 1);
  check("strava session counted for bob", bob.stravaSessions, 1);
  check("ann has no strava sessions", ann.stravaSessions, 0);
}
{
  // The cap must be computed before range filtering, so a week view and a
  // single-day view agree on which workouts scored.
  const athletes = [ath("a", "Ann")];
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T01:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T02:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T03:00:00Z"),
  ];
  const week = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const day = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-10"]);
  check("week view = 60", week[0].points, 60);
  check("day view agrees = 60", day[0].points, 60);
}

console.log("\ntotalPoints applies the cap");
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T01:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T02:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T03:00:00Z"),
  ];
  check("3 gym -> 60 not 90", totalPoints(acts, S), 60);
}

console.log("\nadmin grants: awarded points, not a session");
{
  const athletes = [ath("a", "Ann"), ath("b", "Bob")];
  // Ann runs 10km = 50 pts, then the admin tops her up 50 to clear a 100 quota.
  const acts = [
    run("r1", "a", "2026-08-10", 10),
    grant("gr1", "a", "2026-08-10", 50),
    run("r2", "b", "2026-08-10", 4), // 20 pts
  ];
  const st = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const ann = st.find((s) => s.athlete.id === "a")!;
  check("grant lifts the total 50+50=100", ann.points, 100);
  check("grantedPoints tracked separately", ann.grantedPoints, 50);
  check("grant is not counted as a session", ann.sessions, 1);
  check("grant doesn't touch the sport split", ann.bySport.run, 50);
  check("grant doesn't add distance km", ann.km, 10);
  check("topped-up Ann now leads the week", ann.rank, 1);
  check("goalProgress reflects the grant (100/100)", ann.goalProgress, 1);
  // A grant counts everywhere points do, including totalPoints.
  check("totalPoints includes the grant", totalPoints(acts, S), 120);
}
{
  // Grants land in the season the same as any dated activity.
  const S2 = { ...S, seasonStart: "2026-08-03" };
  const athletes = [ath("j", "Jona"), ath("r", "Ryan")];
  const acts = [
    run("in", "r", "2026-08-05", 4), // Ryan 20 pts
    grant("g", "j", "2026-08-05", 30), // admin awards Jona 30 in-season
  ];
  const champs = seasonChampions(athletes, acts, S2, "2026-08-06", "2026-08-03");
  const live = champs.find((c) => c.status === "live")!;
  check("granted points count toward the season lead", live.champion?.athlete.name, "Jona");
  check("season champion's total includes the grant", live.champion?.points, 30);
}

console.log("\nexcuse: waive the week, flagged excused");
{
  const athletes = [ath("a", "Ann")];
  // Ann earned 40; an excuse tops her up the remaining 60 to hit the 100 quota.
  const acts = [
    run("r1", "a", "2026-08-10", 8), // 40 pts
    excuse("ex1", "a", "2026-08-10", 60),
  ];
  const st = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const ann = st.find((s) => s.athlete.id === "a")!;
  check("excuse lifts the total to quota", ann.points, 100);
  check("excuse counts as granted points", ann.grantedPoints, 60);
  check("row is flagged excused", ann.excused, true);
  check("excuse is not a session", ann.sessions, 1);
}
{
  // A plain award is a grant but NOT an excuse.
  const athletes = [ath("a", "Ann")];
  const st = standingsForRange(athletes, [grant("g", "a", "2026-08-10", 50)], S, [
    "2026-08-10",
    "2026-08-16",
  ]);
  check("a plain award doesn't flag excused", st[0].excused, false);
}

console.log("\nseason window starts at kickoff, not the 1st");
{
  // Seasons are month-aligned (Aug–Sep) but the league opens Mon 3 Aug. The
  // warm-up days before kickoff must not score into Season 1, or whoever
  // logged on the 1st leads a season that hasn't started.
  const S2 = { ...S, seasonStart: "2026-08-03" };
  const s1 = seasonByNumber(1, "2026-08-03");
  check("season 1 opens on the kickoff", s1.start, "2026-08-03");
  check("season 1 is still labelled Aug–Sep", s1.monthsLabel, "Aug–Sep");

  // A season ends on the SUNDAY closing the week its month block ends in, so
  // the last week of a title race is a whole week. Sep 30 2026 is a Wednesday;
  // its week runs to Sun 4 Oct.
  check("season 1 runs to the Sunday, not the 30th", s1.end, "2026-10-04");
  const s2 = seasonByNumber(2, "2026-08-03");
  check("season 2 opens the Monday after", s2.start, "2026-10-05");
  check("and closes on a Sunday too", s2.end, "2026-12-06");

  // The days either side of the old month boundary, which are the ones that
  // change hands: 1-4 Oct still belong to the season that is finishing.
  check("30 Sep is season 1", seasonFor("2026-09-30", "2026-08-03")?.number, 1);
  check("2 Oct is STILL season 1", seasonFor("2026-10-02", "2026-08-03")?.number, 1);
  check("4 Oct is the last day of season 1", seasonFor("2026-10-04", "2026-08-03")?.number, 1);
  check("5 Oct starts season 2", seasonFor("2026-10-05", "2026-08-03")?.number, 2);

  // Whole weeks, season after season, with no day belonging to two seasons.
  let gaps = 0;
  let ragged = 0;
  for (let n = 1; n <= 8; n++) {
    const a = seasonByNumber(n, "2026-08-03");
    const b = seasonByNumber(n + 1, "2026-08-03");
    if (addDays(a.end, 1) !== b.start) gaps++;
    if ((daysBetween(a.start, a.end) + 1) % 7 !== 0) ragged++;
  }
  check("seasons tile the calendar with no gap or overlap", gaps, 0);
  check("every season is a whole number of weeks", ragged, 0);

  const athletes = [ath("j", "Jona"), ath("r", "Ryan")];
  const acts = [
    run("pre", "j", "2026-08-01", 3.353), // warm-up, before kickoff
    { ...run("pre2", "j", "2026-08-01", 0), sport: "swim" as const, km: 0.4, id: "pre2" },
    run("in", "r", "2026-08-05", 4), // after kickoff
  ];
  const champs = seasonChampions(athletes, acts, S2, "2026-08-06", "2026-08-03");
  const live = champs.find((c) => c.status === "live")!;
  check("pre-kickoff logs don't win the season", live.champion?.athlete.name, "Ryan");
  check("champion's points exclude warm-up", live.champion?.points, 20);
}

// The store round-trip is async, so it runs last and owns the summary — the
// runner's CJS transform has no top-level await.
async function storedRateChangesAreNormalised() {
  console.log("\nstored rate changes are normalised on read");
  // The store is the in-memory one (no DATABASE_URL under test), and it runs the
  // same mergeSettings as Postgres does.
  const store = getStore();
  await store.setSettings({
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    rateChanges: [
      { from: "2026-10-01", multipliers: { run: 3 } },
      { from: "2026-08-31", multipliers: { run: 4 } },
      { from: "not-a-date", multipliers: { run: 99 } } as never,
      { from: "2026-09-09" } as never,
      { from: "2026-09-10", multipliers: { run: -1 } } as never,
    ],
    openWaterPerKm: 20, runAscentMetresPerKm: 100, weeklyGoal: 100, seasonStart: "2026-08-03", forfeit: "x",
  });
  const back = await store.getSettings();
  check("sorted oldest-first", back.rateChanges.map((c) => c.from), ["2026-08-31", "2026-10-01"]);
  check("a bad date is dropped, not defaulted",
    back.rateChanges.some((c) => c.multipliers?.run === 99), false);
  check("a change that moves nothing is dropped",
    back.rateChanges.some((c) => c.from === "2026-09-09"), false);
  check("a negative rate is dropped rather than applied",
    back.rateChanges.some((c) => c.from === "2026-09-10"), false);

  // PRODUCTION FIDELITY. The live settings row was written before rate changes
  // existed, so it has no `rateChanges` key at all — exactly like this object.
  // The change has to reach production through the same merge that carried
  // `elevationPer100m` there, and it must not disturb the live bike/gym rates,
  // which differ from the stale numbers in DEFAULT_SETTINGS.
  await store.setSettings({
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
    openWaterPerKm: 20,
    runAscentMetresPerKm: 100,
    weeklyGoal: 100,
    seasonStart: "2026-08-03",
    forfeit: "Run a marathon",
  } as never);
  const prod = await store.getSettings();
  check("a row with no rateChanges picks up the scheduled change",
    prod.rateChanges, [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }]);
  check("Sun 30 Aug on the live row: swim 20 / bike 1 / run 5 / gym 5", [
    ratesOn("2026-08-30", prod).multipliers.swim,
    ratesOn("2026-08-30", prod).multipliers.bike,
    ratesOn("2026-08-30", prod).multipliers.run,
    ratesOn("2026-08-30", prod).multipliers.gym,
  ], [20, 1, 5, 5]);
  check("Mon 31 Aug on the live row: swim 15 / bike 1 / run 4 / gym 5", [
    ratesOn("2026-08-31", prod).multipliers.swim,
    ratesOn("2026-08-31", prod).multipliers.bike,
    ratesOn("2026-08-31", prod).multipliers.run,
    ratesOn("2026-08-31", prod).multipliers.gym,
  ], [15, 1, 4, 5]);
  check("the live bike climb rate survives the merge",
    ratesOn("2026-08-31", prod).elevationPer100m.bike, 1);
}

/**
 * A personal weekly goal, dated.
 *
 * The point of the date is that a week already on the board keeps the quota it
 * was judged against: lowering Jonah's goal must not reach back and un-miss the
 * 65-point week he had before the change.
 */
function personalGoals() {
  console.log("\na personal weekly goal");
  const S: Settings = {
    ...DEFAULT_SETTINGS,
    multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
    weeklyGoal: 100,
    goalChanges: [{ from: "2026-09-21", goals: { Jonah: 50 } }],
  };
  check("Jonah's goal from the change on", goalFor("Jonah", S, "2026-09-21"), 50);
  check("and the week before is still 100", goalFor("Jonah", S, "2026-09-14"), 100);
  check("everyone else is untouched", goalFor("Philippe", S, "2026-09-21"), 100);
  // Jona and Jonah are two different people; a prefix must not match.
  check("Jona keeps the league goal", goalFor("Jona", S, "2026-09-21"), 100);
  check("an unknown name gets the league goal", goalFor("Nobody", S, "2026-09-21"), 100);
  check("no name at all gets the league goal", goalFor(null, S, "2026-09-21"), 100);

  const athletes: Athlete[] = [ath("jonah", "Jonah"), ath("jona", "Jona")];
  const jog = (athleteId: string, occurredOn: string, id: string): Activity => ({
    id, athleteId, sport: "run", km: 5, occurredOn, note: null, createdAt: `${occurredOn}T12:00:00Z`,
    source: "manual", points: null, elevationM: null, openWater: null,
  });
  // 60 points each (three 5 km runs at the dated 4/km): clears a 50 goal, short of 100.
  const acts: Activity[] = [];
  for (let i = 0; i < 3; i++) {
    const day = `2026-09-2${1 + i}`;
    acts.push(jog("jonah", day, `h${i}`), jog("jona", day, `j${i}`));
  }
  const rows = standingsForRange(athletes, acts, S, ["2026-09-21", "2026-09-27"]);
  const jonah = rows.find((r) => r.athlete.id === "jonah")!;
  const jona = rows.find((r) => r.athlete.id === "jona")!;
  check("the same points clear Jonah's quota", [jonah.points >= jonah.goal, jonah.goal], [true, 50]);
  check("and leave Jona short of his", [jona.points >= jona.goal, jona.goal], [false, 100]);
  check("the ring fills against the personal goal", Math.round(jonah.goalProgress * 100) / 100, 1.2);

  // And the shipped default is the one production will read.
  check("the shipped default lowers Jonah from the week of 14 Sep",
    goalFor("Jonah", DEFAULT_SETTINGS, "2026-09-14"), 50);
  check("it still applies the week after", goalFor("Jonah", DEFAULT_SETTINGS, "2026-09-21"), 50);
  // The 65-pt week of 14 Sep is the one being forgiven; the 100-pt weeks before
  // it are not, or the change would rewrite the whole season's forfeits.
  check("but not the week before it",
    goalFor("Jonah", DEFAULT_SETTINGS, "2026-09-13"), 100);
}

personalGoals();

storedRateChangesAreNormalised().then(() => {
  console.log(failures === 0 ? "\nAll passed.\n" : `\n${failures} FAILED\n`);
  process.exit(failures === 0 ? 0 : 1);
});
