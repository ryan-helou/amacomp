import { lastWeekRecap } from "./achievements";
import { DEFAULT_SETTINGS } from "./types";
import type { Activity, Athlete, Settings } from "./types";
import type { DayKey } from "./dates";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

const S: Settings = { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" };
const who = (id: string): Athlete =>
  ({ id, name: id, avatarColor: null, avatarGlyph: null, avatarUrl: null, weightKg: null }) as Athlete;
let n = 0;
const act = (athleteId: string, occurredOn: string, km: number): Activity =>
  ({
    id: `a${n++}`, athleteId, sport: "bike", km, occurredOn,
    elevationM: null, note: "", movingSeconds: null, openWater: null, points: null,
    source: "manual", externalId: null, createdAt: `${occurredOn}T10:00:00Z`,
  }) as unknown as Activity;

// Last week = Mon 28 Sep - Sun 4 Oct, seen from Mon 5 Oct.
const today = "2026-10-05" as DayKey;
const athletes = [who("Ryan"), who("Jonah"), who("George")];
const activities = [
  act("Ryan", "2026-09-20", 50),   // a veteran, in long before
  act("Ryan", "2026-09-29", 150),  // and over quota last week
  act("Jonah", "2026-09-10", 30),  // a veteran who did nothing last week
  // George: nothing, ever. He joined on the 3rd and was held.
];

console.log("\nlast week's missed quota is for men who were playing");
{
  const r = lastWeekRecap(athletes, activities, S, today)!;
  const missed = r.missed.map((s) => s.athlete.id);
  check("a veteran who did nothing that week still missed it", missed.includes("Jonah"), true);
  check("a man who had never logged anything was not in it", missed.includes("George"), false);
  check("and the man over quota did not miss it", missed.includes("Ryan"), false);
}

console.log("\nonce he has logged, he is on the hook like anyone");
{
  // George's first session is the week AFTER — that week, not this one.
  const later = [...activities, act("George", "2026-10-06", 5)];
  const r = lastWeekRecap(athletes, later, S, today)!;
  check("a first session next week doesn't make him owe last week",
    r.missed.map((s) => s.athlete.id).includes("George"), false);

  // A session INSIDE the week puts him in it, short as it was.
  const inside = [...activities, act("George", "2026-10-02", 5)];
  const r2 = lastWeekRecap(athletes, inside, S, today)!;
  check("a short week he did play in still counts as missed",
    r2.missed.map((s) => s.athlete.id).includes("George"), true);
}

if (failed) { console.error(`\n${failed} failing.`); process.exit(1); }
console.log("\nAll recap tests passed.");
