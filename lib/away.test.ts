import { awayThisWeek, JAPAN } from "./away";

/**
 * Trip flags: decoration for a week someone is travelling but NOT excused.
 * The flag must show in any week the trip touches and nowhere else, and must
 * find the athlete by exact name. Run with `npm test`.
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

const athletes = [
  { id: "r", name: "Ryan" },
  // Jonah listed first, so a prefix match on "Jona" would find him.
  { id: "j2", name: "Jonah" },
  { id: "j1", name: "Jona" },
];
const trips = [
  { name: "Ryan", from: "2026-09-11", to: "2026-09-17", flag: JAPAN },
  { name: "Jona", from: "2026-09-11", to: "2026-09-11", flag: JAPAN },
];
const flagged = (day: string) => [...awayThisWeek([], day, athletes, trips).keys()].sort();

console.log("\na trip flies in every week it touches, and only those");
check("week of 31 Aug: nobody", flagged("2026-09-02"), []);
check("week of 7 Sep (trip starts Fri)", flagged("2026-09-08").includes("r"), true);
check("week of 14 Sep (trip ends Thu)", flagged("2026-09-19").includes("r"), true);
check("week of 21 Sep: gone", flagged("2026-09-21"), []);
check("the flag is Japan", awayThisWeek([], "2026-09-15", athletes, trips).get("r")?.label, "Japan");

console.log("\nnames match exactly");
check("Jona flagged, Jonah not", flagged("2026-09-08"), ["j1", "r"]);

console.log(failures === 0 ? "\nAll away tests passed.\n" : `\n${failures} away test(s) FAILED.\n`);
if (failures > 0) process.exit(1);
