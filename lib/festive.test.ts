import { dayOfChristmas, festiveFor, isChristmas } from "./festive";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}
console.log("\nthe Christmas look runs Dec 7 to Jan 6");
check("Dec 6, the last day of Season 2, is plain", isChristmas("2026-12-06"), false);
check("Dec 7, kickoff, is Christmas", isChristmas("2026-12-07"), true);
check("Christmas Day is Christmas", isChristmas("2026-12-25"), true);
check("Jan 6 is the last day", isChristmas("2027-01-06"), true);
check("Jan 7 is plain again", isChristmas("2027-01-07"), false);
check("the preview forces it on", festiveFor("2026-11-27", "on"), true);
check("the preview can hide it", festiveFor("2026-12-25", "off"), false);
check("no preview follows the date", festiveFor("2026-12-25", null), true);
console.log("\nthe twelve days of Christmas");
check("Dec 25 is the 1st day of Christmas", dayOfChristmas("2026-12-25"), 1);
check("Jan 5 is the 12th", dayOfChristmas("2027-01-05"), 12);
check("Jan 6 is past the twelve", dayOfChristmas("2027-01-06"), null);
check("Dec 24 is not yet", dayOfChristmas("2026-12-24"), null);

if (failed) { console.error(`\n${failed} failing.`); process.exit(1); }
console.log("\nAll festive tests passed.");
