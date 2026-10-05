import { bountyWinner, parseRule, ruleMetOn, type BountyRule } from "./bountyRules";
import { bountyCoins, bountyFor, isOpen, type Bounty } from "./bounties";
import { DEFAULT_SETTINGS } from "./types";
import type { Activity, Settings } from "./types";
import type { DayKey } from "./dates";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

const S: Settings = { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" };

let n = 0;
const act = (
  athleteId: string,
  occurredOn: string,
  sport: Activity["sport"],
  km: number,
  movingSeconds: number | null = null,
): Activity =>
  ({
    id: `a${n++}`, athleteId, sport, km, occurredOn,
    elevationM: null, note: "", movingSeconds, openWater: null, points: null,
    source: "manual", externalId: null, createdAt: `${occurredOn}T10:00:00Z`,
  }) as unknown as Activity;

const from = "2026-10-05" as DayKey;

/** Day N of October, zero-padded — `2026-10-0${5+i}` overflows past the 9th. */
const oct = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;

console.log("\na streak is consecutive days, and nothing less");
{
  const r: BountyRule = { kind: "streak", sport: "run", days: 7 };
  const seven = Array.from({ length: 7 }, (_, i) => act("a", oct(5 + i), "run", 5));
  check("seven straight runs wins, on the seventh day",
    ruleMetOn(r, "a", seven, S, from, "2026-10-20" as DayKey), "2026-10-11");
  check("six does not",
    ruleMetOn(r, "a", seven.slice(0, 6), S, from, "2026-10-20" as DayKey), null);

  // The whole point of a streak: a gap resets it. Seven runs with a day off
  // in the middle is SEVEN RUNS and no streak — the version of this test that
  // used six runs passed even with the reset deleted, because six never
  // reaches seven however you count it.
  const gapped = [
    ...[5, 6, 7, 8].map((d) => act("a", oct(d), "run", 5)),
    ...[10, 11, 12].map((d) => act("a", oct(d), "run", 5)),
  ];
  check("seven runs around a day off is not a seven day streak",
    ruleMetOn(r, "a", gapped, S, from, "2026-10-20" as DayKey), null);
  check("but close the gap and it is",
    ruleMetOn(r, "a", [...gapped, act("a", oct(9), "run", 5)], S, from, "2026-10-20" as DayKey),
    "2026-10-11");

  // Two runs on one day is one day of the streak, not two.
  const doubled = [...seven.slice(0, 6), act("a", "2026-10-10", "run", 5)];
  check("two runs in a day is still one day",
    ruleMetOn(r, "a", doubled, S, from, "2026-10-20" as DayKey), null);

  // The sport matters: riding is not running.
  const mixed = seven.map((a, i) => (i === 3 ? act("a", "2026-10-08", "bike", 30) : a));
  check("a ride does not keep a run streak alive",
    ruleMetOn(r, "a", mixed, S, from, "2026-10-20" as DayKey), null);
  check("but it does keep an \"anything\" streak alive",
    ruleMetOn({ kind: "streak", sport: "any", days: 7 }, "a", mixed, S, from, "2026-10-20" as DayKey),
    "2026-10-11");
}

console.log("\nnothing before the bounty was posted counts");
{
  const r: BountyRule = { kind: "streak", sport: "run", days: 3 };
  const before = ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) => act("a", d, "run", 5));
  check("a streak finished last week does not win it",
    ruleMetOn(r, "a", before, S, from, "2026-10-20" as DayKey), null);
}

console.log("\npoints, sports and hours");
{
  // 100 km ride = 100 points at 1/km.
  check("a hundred-point day",
    ruleMetOn({ kind: "pointsInDay", points: 100 }, "a", [act("a", "2026-10-06", "bike", 100)], S, from, "2026-10-20" as DayKey),
    "2026-10-06");
  check("ninety-nine is not a hundred",
    ruleMetOn({ kind: "pointsInDay", points: 100 }, "a", [act("a", "2026-10-06", "bike", 99)], S, from, "2026-10-20" as DayKey),
    null);

  const fourSports = [
    act("a", "2026-10-07", "swim", 1), act("a", "2026-10-07", "bike", 20),
    act("a", "2026-10-07", "run", 5), act("a", "2026-10-07", "gym", 1),
  ];
  check("four sports in a day", ruleMetOn({ kind: "sportsInDay", sports: 4 }, "a", fourSports, S, from, "2026-10-20" as DayKey), "2026-10-07");
  check("three is not four", ruleMetOn({ kind: "sportsInDay", sports: 4 }, "a", fourSports.slice(0, 3), S, from, "2026-10-20" as DayKey), null);
  check("and four on separate days is not four in a day",
    ruleMetOn({ kind: "sportsInDay", sports: 4 }, "a",
      ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"].map((d, i) =>
        act("a", d, (["swim", "bike", "run", "gym"] as const)[i], 5)), S, from, "2026-10-20" as DayKey),
    null);

  // Mon 5 Oct -> Sun 11 Oct. Ten hours inside it.
  const hours = [act("a", "2026-10-06", "bike", 100, 6 * 3600), act("a", "2026-10-08", "run", 20, 4 * 3600)];
  check("ten hours in a week pays on the Sunday",
    ruleMetOn({ kind: "hoursInWeek", hours: 10 }, "a", hours, S, from, "2026-10-20" as DayKey), "2026-10-11");
  check("but not while the week is still running",
    ruleMetOn({ kind: "hoursInWeek", hours: 10 }, "a", hours, S, from, "2026-10-09" as DayKey), null);
  check("ten hours spread over two weeks is not a ten hour week",
    ruleMetOn({ kind: "hoursInWeek", hours: 10 }, "a",
      [act("a", "2026-10-06", "bike", 100, 6 * 3600), act("a", "2026-10-13", "run", 20, 4 * 3600)],
      S, from, "2026-10-31" as DayKey),
    null);
  check("a hand-logged session has no time and cannot help",
    ruleMetOn({ kind: "hoursInWeek", hours: 10 }, "a",
      [act("a", "2026-10-06", "bike", 300, null)], S, from, "2026-10-20" as DayKey), null);
}

console.log("\nthe earliest day wins it, and a dead heat waits");
{
  const r: BountyRule = { kind: "pointsInDay", points: 100 };
  const acts = [act("a", "2026-10-09", "bike", 100), act("b", "2026-10-07", "bike", 100)];
  check("whoever got there first", bountyWinner(r, ["a", "b"], acts, S, from, "2026-10-20" as DayKey), { athleteId: "b", day: "2026-10-07" });
  check("a dead heat is nobody, for now",
    bountyWinner(r, ["a", "b"], [act("a", "2026-10-07", "bike", 100), act("b", "2026-10-07", "bike", 100)], S, from, "2026-10-20" as DayKey),
    null);
  check("and nobody at all is null", bountyWinner(r, ["a", "b"], [], S, from, "2026-10-20" as DayKey), null);
}

console.log("\na self-awarding bounty closes itself and pays, with no row written");
{
  const b: Bounty = {
    id: "y", title: "100 points in a day", detail: "", coins: 150, state: "open",
    postedBy: "ryan", claimedBy: null, claimedAt: null, expiresOn: "2026-12-06",
    rule: { kind: "pointsInDay", points: 100 }, createdAt: "2026-10-05T01:00:00Z",
  };
  const league = { athleteIds: ["a", "b"], activities: [act("a", "2026-10-09", "bike", 100)], settings: S };
  const bare = { athleteIds: ["a", "b"], activities: [], settings: S };

  check("open while nobody has done it", isOpen(b, "2026-10-20" as DayKey, bare), true);
  check("and closed the moment somebody has", isOpen(b, "2026-10-20" as DayKey, league), false);
  check("the winner is named", bountyFor(b, league, "2026-10-20" as DayKey), { athleteId: "a", day: "2026-10-09" });
  check("it pays him", bountyCoins("a", b, league, "2026-10-20" as DayKey), 150);
  check("and nobody else", bountyCoins("b", b, league, "2026-10-20" as DayKey), 0);
  check("state is still 'open' — nothing was written", b.state, "open");

  // The whole reason this is derived: strike the session off and the coins go.
  check("strike the session off and the coins go with it",
    bountyCoins("a", b, bare, "2026-10-20" as DayKey), 0);

  // A rule met after the bounty lapsed is not a win.
  const lapsed = { ...b, expiresOn: "2026-10-08" as DayKey };
  check("a rule met after it expired pays nobody",
    bountyCoins("a", lapsed, league, "2026-10-20" as DayKey), 0);
}

console.log("\na hand-judged bounty is untouched");
{
  const b: Bounty = {
    id: "z", title: "Drag Jonah out on a Sunday", detail: "", coins: 200, state: "paid",
    postedBy: "ryan", claimedBy: "a", claimedAt: "2026-10-09T10:00:00Z", expiresOn: null,
    rule: null, createdAt: "2026-10-05T01:00:00Z",
  };
  const league = { athleteIds: ["a", "b"], activities: [], settings: S };
  check("still pays the man Ryan paid", bountyCoins("a", b, league, "2026-10-20" as DayKey), 200);
  check("and still pays nobody else", bountyCoins("b", b, league, "2026-10-20" as DayKey), 0);
}

console.log("\nrubbish in a rule column is no rule, not a crash");
{
  check("a missing rule", parseRule(null), null);
  check("an unknown kind", parseRule({ kind: "vibes", days: 7 }), null);
  check("a negative count", parseRule({ kind: "streak", sport: "run", days: -1 }), null);
  check("a bad sport", parseRule({ kind: "streak", sport: "curling", days: 7 }), null);
  check("a good one", parseRule({ kind: "streak", sport: "run", days: 7 }), { kind: "streak", sport: "run", days: 7 });
}

if (failed) {
  console.error(`\n${failed} failing.`);
  process.exit(1);
}
console.log("\nAll bounty-rule tests passed.");
