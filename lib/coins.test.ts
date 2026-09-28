import { COIN_RATES, coinAccount, coinBoard, fmtCoins } from "./coins";
import { DEFAULT_SETTINGS, type Activity, type Athlete, type Settings } from "./types";

/**
 * Tri coins. Every coin has to trace to something that happened on the board,
 * so the tests here are about WHEN a coin is paid as much as how many.
 *
 * The rule that matters: a week pays nothing until it is over. If a live week
 * paid its win bonus, a balance would drop when someone overtook you on Sunday
 * night — and a currency that can fall is a currency nobody trusts.
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

const ath = (id: string, name: string): Athlete => ({
  id, name, weightKg: null, avatarColor: null, avatarGlyph: null, avatarUrl: null,
});

/** A run of `km`, scored at the settings' own rate for that day. */
function run(id: string, athleteId: string, day: string, km: number): Activity {
  return {
    id, athleteId, sport: "run", km, occurredOn: day, note: null, source: "manual",
    points: null, elevationM: null, openWater: null, movingSeconds: null, localHour: 12,
    createdAt: `${day}T12:00:00Z`,
  };
}

// Run 5/km all the way through, so the arithmetic below is readable.
const S: Settings = {
  ...DEFAULT_SETTINGS,
  multipliers: { swim: 20, bike: 1, run: 5, gym: 5 },
  rateChanges: [],
  goalChanges: [],
  weeklyGoal: 100,
  seasonStart: "2026-08-03",
};

const ANN = ath("a", "Ann");
const BO = ath("b", "Bo");
const athletes = [ANN, BO];

console.log("\na point is a coin");
{
  // Ann runs 30 km in the week of 3 Aug: 150 points, quota met, week won.
  const acts = [run("r1", "a", "2026-08-05", 30), run("r2", "b", "2026-08-05", 4)];
  const ann = coinAccount("a", athletes, acts, S, "2026-08-12");
  check("points pay one for one", ann.entries.find((e) => e.kind === "points")?.amount, 150);
  check("quota pays its bonus", ann.entries.find((e) => e.kind === "quota")?.amount, COIN_RATES.quota);
  check("the week win pays too", ann.entries.find((e) => e.kind === "week")?.amount, COIN_RATES.weekWin);
  check("so the balance is 150 + 25 + 50", ann.balance, 225);

  // Bo scored 20: coins for the points, nothing else.
  const bo = coinAccount("b", athletes, acts, S, "2026-08-12");
  check("a short week pays only the points", bo.balance, 20);
  check("and says so in one line", bo.entries.map((e) => e.kind), ["points"]);
}

console.log("\nnothing is paid for a week still running");
{
  const acts = [run("r1", "a", "2026-08-05", 30)];
  // Same week, read from inside it: the points are banked, the bonuses are not.
  const live = coinAccount("a", athletes, acts, S, "2026-08-06");
  check("the points are already yours", live.balance, 150);
  check("but no quota or win bonus yet",
    live.entries.some((e) => e.kind !== "points"), false);
  // And the moment the week is over, both land.
  check("the week after, they do", coinAccount("a", athletes, acts, S, "2026-08-12").balance, 225);
}

console.log("\nthe quota bonus follows the quota, not the points");
{
  // Jonah's goal is 50 from 14 Sep, so 60 points clears it where 100 wouldn't.
  const jonah = ath("j", "Jonah");
  const S2: Settings = { ...S, goalChanges: [{ from: "2026-09-14", goals: { Jonah: 50 } }] };
  const acts = [run("r1", "j", "2026-09-15", 12)]; // 60 pts
  const acc = coinAccount("j", [jonah], acts, S2, "2026-09-22");
  check("a 60-point week clears a 50 goal", acc.entries.some((e) => e.kind === "quota"), true);
  check("balance is 60 + 25 + the week win", acc.balance, 135);
}

console.log("\nan excused week is not a week won");
{
  const excuse: Activity = {
    ...run("ex", "a", "2026-08-05", 0), source: "excuse", points: 100, km: 0,
  };
  const acc = coinAccount("a", athletes, [excuse], S, "2026-08-12");
  // The top-up is points like any other, so it pays — being excused shouldn't
  // also cost you the coins. What it must not do is invent a second bonus.
  check("the top-up pays as points", acc.entries.filter((e) => e.kind === "points").length, 1);
  check("and the quota bonus lands once", acc.entries.filter((e) => e.kind === "quota").length, 1);
}

console.log("\nthe rich list");
{
  const acts = [run("r1", "a", "2026-08-05", 30), run("r2", "b", "2026-08-05", 4)];
  const board = coinBoard(athletes, acts, S, "2026-08-12");
  check("sorted by balance", board.map((r) => [r.athlete.name, r.balance]), [["Ann", 225], ["Bo", 20]]);
  check("coins are whole and grouped", fmtCoins(1716.4), "1,716");
}

console.log(failures === 0 ? "\nAll coin tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
