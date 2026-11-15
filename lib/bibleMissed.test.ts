import { bibleTickKind, markBible, missedBibleDays } from "./bible";
import { activityPoints } from "./scoring";
import { DEFAULT_SETTINGS, type Activity, type Settings } from "./types";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}
const S: Settings = { ...DEFAULT_SETTINGS, multipliers: { swim: 20, bike: 1, run: 4, gym: 5 }, rateChanges: [] };
let n = 0;
const run = (athleteId: string, day: string, km: number): Activity => ({
  id: `r${++n}`, athleteId, sport: "run", km, occurredOn: day, note: null, source: "strava", points: null,
  elevationM: null, movingSeconds: null, localHour: 12, openWater: null, treadmill: false, createdAt: "2026-11-01T00:00:00Z",
});

console.log("\nmissed Bible days list only past, unticked days of your own");
{
  const acts = markBible(
    [run("j", "2026-11-11", 5), run("j", "2026-11-11", 2.5), run("j", "2026-11-09", 4), run("j", "2026-11-13", 6),
     run("j", "2026-11-02", 10), run("p", "2026-11-10", 8)],
    [{ athleteId: "j", day: "2026-11-09" }],
  );
  const got = missedBibleDays(acts, "j", "2026-11-13", (a) => activityPoints(a, S));
  check("only the 11th: the 9th is ticked, today has its own box, the 2nd is before the rule",
    got, [{ day: "2026-11-11", points: 30, sessions: 2 }]);
  const zero = markBible([{ ...run("j", "2026-11-10", 0), sport: "gym", km: 1, sets: null }], []);
  check("a day that would still score 0 isn't a lost day",
    missedBibleDays(zero, "j", "2026-11-13", (a) => activityPoints(a, S)), []);
  check("someone else's days aren't yours", missedBibleDays(acts, "x", "2026-11-13", (a) => activityPoints(a, S)), []);
}

console.log("\nthe box ticks the phone's day, even a day off Toronto");
{
  // Ryan in China, 9 AM on the 15th: Toronto is still on the 14th.
  check("a day ahead of Toronto is today", bibleTickKind("2026-11-15", "2026-11-14"), "today");
  check("the same day is today", bibleTickKind("2026-11-14", "2026-11-14"), "today");
  check("a day behind Toronto is today", bibleTickKind("2026-11-13", "2026-11-14"), "today");
  check("older is a past day", bibleTickKind("2026-11-10", "2026-11-14"), "past");
  check("two days ahead is refused", bibleTickKind("2026-11-16", "2026-11-14"), null);
}

if (failed) { console.error(`\n${failed} failing.`); process.exit(1); }
console.log("\nAll missed-Bible tests passed.");
