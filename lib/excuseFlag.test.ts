import { excuseFlagSvg } from "./flags";
import { flagFor } from "./away";

let failed = 0;
function check(what: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : ` — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
}

console.log("\nthe little flag beside Excused");
{
  const cn = excuseFlagSvg("China");
  check("China gets one", cn?.label, "China");
  check("red field, five yellow stars", [cn?.svg.includes("#EE1C25"), (cn?.svg.match(/#FFFF00/g) ?? []).length], [true, 5]);
  check("and NOT the away-week row paint", flagFor("China"), null);
  check("a shop country works too", excuseFlagSvg("in Lebanon for the wedding")?.label, "Lebanon");
  check("no country, no flag", excuseFlagSvg("sick"), null);
  check("no note, no flag", excuseFlagSvg(null), null);
}

if (failed) { console.error(`\n${failed} failing.`); process.exit(1); }
console.log("\nAll excuse-flag tests passed.");
