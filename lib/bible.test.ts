import { BIBLE_FROM, markBible } from "./bible";
import { activityPoints } from "./scoring";
import { DEFAULT_SETTINGS } from "./types";
import type { Activity, Settings } from "./types";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

const S: Settings = { ...DEFAULT_SETTINGS, rateChanges: [] };
let n = 0;
const act = (athleteId: string, occurredOn: string, km = 10, points: number | null = null): Activity =>
  ({
    id: `a${n++}`, athleteId, sport: points === null ? "bike" : "gym", km: points === null ? km : 0, occurredOn,
    elevationM: null, note: "", movingSeconds: null, openWater: null, points,
    source: points === null ? "manual" : "admin", externalId: null, createdAt: `${occurredOn}T10:00:00Z`,
  }) as unknown as Activity;

const pts = (list: Activity[]) => list.reduce((s, a) => s + activityPoints(a, S), 0);

console.log("\nno tick, no points");
{
  const day = BIBLE_FROM;
  const ride = [act("a", day)];
  check("an unticked day scores nothing", pts(markBible(ride, [])), 0);
  check("tick it and the ride counts", pts(markBible(ride, [{ athleteId: "a", day }])), 10);
  check("somebody else's tick doesn't count for you", pts(markBible(ride, [{ athleteId: "b", day }])), 0);
  check("yesterday's tick doesn't count for today",
    pts(markBible([act("a", "2026-11-04")], [{ athleteId: "a", day: "2026-11-03" }])), 0);
}

console.log("\nthe past is left alone");
{
  check("a session the day before the rule keeps its points",
    pts(markBible([act("a", "2026-11-02")], [])), 10);
  check("and so does one from October", pts(markBible([act("a", "2026-10-15")], [])), 10);
}

console.log("\nan admin grant is not a session");
{
  const grant = act("a", BIBLE_FROM, 0, 50);
  check("a grant on an unticked day still pays", pts(markBible([grant], [])), 50);
}

if (failed) {
  console.error(`\n${failed} failing.`);
  process.exit(1);
}
console.log("\nAll Bible tests passed.");
