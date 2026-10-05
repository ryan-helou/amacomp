import { earnedPrizes } from "./prizes";
import { DEFAULT_SETTINGS } from "./types";
import type { Activity, Athlete, Settings } from "./types";
import type { DayKey } from "./dates";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

// Season 1 = 3 Aug - 4 Oct. Seen from inside Season 2.
const S: Settings = { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" };
const today = "2026-10-06" as DayKey;
const who = (id: string): Athlete =>
  ({ id, name: id, avatarColor: null, avatarGlyph: null, avatarUrl: null, weightKg: null }) as Athlete;
let n = 0;
const ride = (athleteId: string, occurredOn: string, km: number): Activity =>
  ({
    id: `a${n++}`, athleteId, sport: "bike", km, occurredOn,
    elevationM: null, note: "", movingSeconds: null, openWater: null, points: null,
    source: "manual", externalId: null, createdAt: `${occurredOn}T10:00:00Z`,
  }) as unknown as Activity;

const people = ["first", "second", "third", "fourth"].map(who);
const acts = [
  ride("first", "2026-09-10", 400),
  ride("second", "2026-09-11", 300),
  ride("third", "2026-09-12", 200),
  ride("fourth", "2026-09-13", 100),
];
const has = (id: string, prize: string) => earnedPrizes(id, people, acts, S, today).has(prize);

console.log("\nthe podium wears what it won, and nothing else");
check("first wears the crown", has("first", "prize.crown"), true);
check("first does NOT get the runner-up's circlet", has("first", "prize.silver"), false);
check("first does not get bronze either", has("first", "prize.bronze"), false);
check("second gets silver", has("second", "prize.silver"), true);
check("second does not get the crown", has("second", "prize.crown"), false);
check("third gets bronze", has("third", "prize.bronze"), true);
check("fourth gets no circlet", has("fourth", "prize.silver") || has("fourth", "prize.bronze") || has("fourth", "prize.crown"), false);

console.log("\nmedals and sashes are wins, not a shelf");
check("a man who has won a week has a medal", has("first", "prize.medal"), true);
check("a man who has never won a week has none", has("fourth", "prize.medal"), false);
check("everyone can take a trophy off", has("fourth", "prize.none"), true);

if (failed) { console.error(`\n${failed} failing.`); process.exit(1); }
console.log("\nAll prize tests passed.");
