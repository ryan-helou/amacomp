import { climbLeader, climbStandings, fmtMetres } from "./climb";
import type { Activity, Athlete } from "./types";

/**
 * King of the Mountains.
 *
 * The board's whole reason to exist is that it ranks differently from the
 * points table, so the things worth guarding are the ones that would quietly
 * turn it back into a copy of the points table or of the kilometre board:
 * counting sports that have no gradient, counting admin grants as climbs, or
 * ranking on sessions instead of metres. Run with `npm test`.
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

function athlete(id: string, name: string): Athlete {
  return { id, name, weightKg: null, avatarColor: null, avatarGlyph: null, avatarUrl: null };
}
const ANA = athlete("a", "Ana");
const BEN = athlete("b", "Ben");

let seq = 0;
function act(
  who: Athlete,
  sport: Activity["sport"],
  day: string,
  km: number,
  elevationM: number | null,
  source: Activity["source"] = "manual",
): Activity {
  seq += 1;
  return {
    id: `x${seq}`,
    movingSeconds: null, localHour: 12,
    athleteId: who.id,
    sport,
    km,
    occurredOn: day,
    note: null,
    source,
    points: source === "admin" ? 500 : null,
    elevationM,
    openWater: null,
    createdAt: `${day}T12:00:00Z`,
  };
}

const WINDOW: [string, string] = ["2026-08-03", "2026-09-30"];

console.log("\nmetres are what is ranked — not kilometres, not sessions");
{
  // Ben rides further but flatter; Ana climbs more off fewer, steeper sessions.
  // On the kilometre board Ben wins; on this one he must not.
  const acts = [
    act(ANA, "bike", "2026-08-10", 20, 900),
    act(BEN, "bike", "2026-08-10", 200, 100),
    act(BEN, "bike", "2026-08-11", 200, 100),
  ];
  const rows = climbStandings([ANA, BEN], acts, WINDOW);
  check("Ana leads on metres", rows[0].athlete.id, "a");
  check("despite ten times less distance", rows[0].total, 900);
  check("Ben is second on 200 m", [rows[1].athlete.id, rows[1].total], ["b", 200]);
  check("and had more sessions", rows[1].sessions, 2);
}

console.log("\nonly the sports with a gradient count");
{
  const acts = [
    act(ANA, "bike", "2026-08-10", 30, 400),
    act(ANA, "run", "2026-08-11", 10, 300),
    // Strava puts metres on indoor sessions; a pool and a gym have no ascent.
    act(ANA, "swim", "2026-08-12", 2, 250),
    act(ANA, "gym", "2026-08-13", 1, 250),
  ];
  const rows = climbStandings([ANA], acts, WINDOW);
  check("bike and run only", rows[0].total, 700);
  check("split by discipline", rows[0].bySport, { bike: 400, run: 300 });
  check("and the ignored ones are not counted as sessions", rows[0].sessions, 2);
}

console.log("\nnobody is awarded a mountain");
{
  const acts = [
    act(ANA, "bike", "2026-08-10", 30, 400),
    // An admin grant is points. It is stored as an activity, and if it ever
    // carried an elevation it must not become a climb.
    act(BEN, "bike", "2026-08-10", 0, 5000, "admin"),
  ];
  const rows = climbStandings([ANA, BEN], acts, WINDOW);
  check("the grant climbs nothing", rows.find((r) => r.athlete.id === "b")!.total, 0);
  check("so Ana leads", rows[0].athlete.id, "a");
}

console.log("\nthe window is respected and missing elevation is not a zero-metre session");
{
  const acts = [
    act(ANA, "bike", "2026-07-30", 30, 900), // before the season
    act(ANA, "bike", "2026-08-10", 30, 400), // inside
    act(ANA, "run", "2026-08-11", 10, null), // no reading at all
  ];
  const rows = climbStandings([ANA], acts, WINDOW);
  check("only the session inside the window counts", rows[0].total, 400);
  check("and a session with no reading is not counted", rows[0].sessions, 1);
}

console.log("\nthe discipline sub-titles can have a different holder from the board");
{
  // Ben wins overall on the strength of his riding; Ana wins on foot. This is
  // the entire point of the board, so it is the thing most worth asserting.
  const acts = [
    act(BEN, "bike", "2026-08-10", 60, 1200),
    act(BEN, "run", "2026-08-11", 10, 100),
    act(ANA, "bike", "2026-08-10", 20, 200),
    act(ANA, "run", "2026-08-11", 12, 500),
  ];
  const rows = climbStandings([ANA, BEN], acts, WINDOW);
  check("Ben is King of the Mountains overall", rows[0].athlete.id, "b");
  check("Ben climbs most on the bike", climbLeader(rows, "bike")!.athlete.id, "b");
  check("but Ana climbs most on foot", climbLeader(rows, "run")!.athlete.id, "a");
  check("with her real total", climbLeader(rows, "run")!.metres, 500);
}

console.log("\nan empty board says nobody, rather than picking someone");
{
  const rows = climbStandings([ANA, BEN], [], WINDOW);
  check("everyone still appears", rows.length, 2);
  check("on nothing", rows[0].total, 0);
  check("and there is no bike leader to name", climbLeader(rows, "bike"), null);
  check("nor a running one", climbLeader(rows, "run"), null);
}

console.log("\nties share a place");
{
  const acts = [act(ANA, "bike", "2026-08-10", 30, 500), act(BEN, "run", "2026-08-10", 5, 500)];
  const rows = climbStandings([ANA, BEN], acts, WINDOW);
  check("both first", [rows[0].rank, rows[1].rank], [1, 1]);
}

console.log("\nmetres are written the way people say them");
{
  check("thousands are separated", fmtMetres(1181), "1,181");
  check("and never fractional", fmtMetres(1181.4), "1,181");
}

console.log(
  failures === 0 ? "\nAll climb tests passed.\n" : `\n${failures} climb test(s) FAILED.\n`,
);
if (failures > 0) process.exit(1);
