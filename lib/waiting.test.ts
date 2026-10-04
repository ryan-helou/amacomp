import { waitingFor } from "./waiting";
import { DEFAULT_SETTINGS, type Activity, type Athlete } from "./types";

/** The coming-soon hold: who gets it, and when it lets go. */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`  ok   ${label}`);
  else { failures++; console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`); }
}

const S = { ...DEFAULT_SETTINGS, seasonStart: "2026-08-03" };
const ath = (id: string, name: string): Athlete =>
  ({ id, name, weightKg: null, avatarColor: null, avatarGlyph: null, avatarUrl: null });
const george = ath("g", "George");
const ryan = ath("r", "Ryan");
const run = (who: string, day: string): Activity => ({
  id: `${who}-${day}`, athleteId: who, sport: "run", km: 5, occurredOn: day, note: null,
  source: "manual", points: null, elevationM: null, openWater: null, movingSeconds: null,
  localHour: 12, createdAt: "2026-10-03T10:00:00Z",
});

// Season 1 runs to 2026-10-04; Season 2 opens 2026-10-05.
console.log("\na man who joined before his season starts is held");
check("George, two days out", waitingFor(george, [], S, "2026-10-03")?.number, 2);
check("and the day before", waitingFor(george, [], S, "2026-10-04")?.number, 2);
check("told which season he is waiting for", waitingFor(george, [], S, "2026-10-03")?.start, "2026-10-05");

console.log("\nit lets go on its own, both ways");
// The whole point: nobody has to remember to turn this off.
check("the morning the season opens", waitingFor(george, [], S, "2026-10-05"), null);
check("and every day after", waitingFor(george, [], S, "2026-11-20"), null);
check("a man who has trained is not waiting",
  waitingFor(george, [run("g", "2026-09-30")], S, "2026-10-03"), null);
// The bug the first version shipped with: on the morning Season 2 opened he
// had still logged nothing, so he was held again — for Season 3. A welcome
// screen that never lifts is a locked door.
check("and he is NOT held again for the season after",
  waitingFor(george, [], S, "2026-10-05"), null);
check("nor a fortnight into it", waitingFor(george, [], S, "2026-10-19"), null);

console.log("\njoining mid-season is just joining");
// There is nothing to protect him from: he can still score this season.
check("a newcomer in week two gets the board",
  waitingFor(george, [], S, "2026-08-17"), null);
check("and in the last week he is held", waitingFor(george, [], S, "2026-10-01")?.number, 2);

console.log("\nit holds nobody else");
check("Ryan, who has been at it since August",
  waitingFor(ryan, [run("r", "2026-08-10")], S, "2026-10-03"), null);
check("somebody else's sessions don't release George",
  waitingFor(george, [run("r", "2026-08-10")], S, "2026-10-03")?.number, 2);
check("signed out", waitingFor(null, [], S, "2026-10-03"), null);

console.log(failures === 0 ? "\nAll waiting tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
