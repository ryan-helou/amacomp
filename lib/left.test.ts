import { isLeftIn } from "./left";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}
const K = "2026-08-03";
console.log("\nan athlete who left is greyed from his season on");
check("Jonah in Season 1 is not greyed", isLeftIn("Jonah", "2026-09-20", K), false);
check("Jonah in Season 2 is greyed", isLeftIn("Jonah", "2026-11-15", K), true);
check("Jonah in Season 3 is greyed", isLeftIn("Jonah", "2026-12-20", K), true);
check("Jona is someone else", isLeftIn("Jona", "2026-11-15", K), false);
if (failed) { console.error(`\n${failed} failing.`); process.exit(1); }
console.log("\nAll left tests passed.");
