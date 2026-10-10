import { rateAnnouncementFor } from "./announce";
import { elevationPointsFor } from "./scoring";
import { DEFAULT_SETTINGS, elevationRateLabel, type Settings } from "./types";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`}`);
  if (!ok) failures++;
}

const BIKE33 = 100 / 33;

console.log("\nthe climbing label reads the way the rate was set");
check("1 per 100 m", elevationRateLabel(1), "1/100m");
check("a point every 33 m", elevationRateLabel(BIKE33), "1/33m");
check("nothing for no rate", elevationRateLabel(0), "");

console.log("\n33 m of climbing on the bike is one point, on any date");
const S: Settings = {
  ...DEFAULT_SETTINGS,
  elevationPer100m: { ...DEFAULT_SETTINGS.elevationPer100m, bike: BIKE33 },
  rateChanges: [{ from: "2026-08-31", multipliers: { swim: 15, run: 4 } }],
  retroChanges: [{ on: "2026-10-10", sport: "bike", climb: true, before: 1, after: BIKE33 }],
};
check("in August", Math.round(elevationPointsFor(330, "bike", S, "2026-08-10") * 1000) / 1000, 10);
check("in October", Math.round(elevationPointsFor(330, "bike", S, "2026-10-12") * 1000) / 1000, 10);

console.log("\nan all-time change is announced as one");
const a = rateAnnouncementFor("2026-10-10", S);
check("it is announced", !!a, true);
check("as retroactive", a?.retroactive, true);
check("bike climbing, 1 -> 1/33m", a?.moves, [{ sport: "bike", before: 1, after: BIKE33, climb: true }]);
check("still shown a week later", !!rateAnnouncementFor("2026-10-17", S), true);
check("not after that", rateAnnouncementFor("2026-10-25", S), null);
check("not before it was made", rateAnnouncementFor("2026-10-09", S)?.retroactive ?? false, false);

console.log("\na dated change still reads as dated");
const D: Settings = { ...DEFAULT_SETTINGS, rateChanges: [{ from: "2026-10-12", multipliers: { run: 5 } }] };
check("not retroactive", rateAnnouncementFor("2026-10-12", D)?.retroactive ?? false, false);

if (failures) { console.error(`\n${failures} failing.`); process.exit(1); }
console.log("\nAll retroactive-change tests passed.");
