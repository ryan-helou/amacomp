import { unscoredGymIds, standingsForRange, totalPoints } from "./scoring";
import { seasonByNumber, seasonChampions } from "./season";
import { DEFAULT_SETTINGS, type Activity, type Athlete } from "./types";

/**
 * Scoring rules are the one part of this app where a bug costs someone a real
 * forfeit, so they get a regression test. Run with `npm test`.
 *
 * The gym cap is the important one: gym scores flat per workout, so without a
 * cap N taps = N × 30 points and one afternoon beats the weekly quota twice over.
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

const S = DEFAULT_SETTINGS; // gym 30/workout, run 5/km

function gym(id: string, athleteId: string, day: string, createdAt: string): Activity {
  return { id, athleteId, sport: "gym", km: 1, occurredOn: day, note: null, source: "manual", points: null, createdAt };
}
function run(id: string, athleteId: string, day: string, km: number): Activity {
  return { id, athleteId, sport: "run", km, occurredOn: day, note: null, source: "strava", points: null, createdAt: "2026-08-10T10:00:00Z" };
}
function grant(id: string, athleteId: string, day: string, points: number): Activity {
  return { id, athleteId, sport: "run", km: 0, occurredOn: day, note: null, source: "admin", points, createdAt: "2026-08-11T10:00:00Z" };
}

const ath = (id: string, name: string): Athlete => ({
  id, name, resetHour: 0, avatarColor: null, avatarGlyph: null, avatarUrl: null,
});

console.log("\nunscoredGymIds");
{
  // 3 gym in one day -> only the 3rd is dropped, and it's the LATEST one.
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T12:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T18:00:00Z"),
  ];
  check("3 same day -> drops the latest", [...unscoredGymIds(acts)], ["g3"]);
}
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T12:00:00Z"),
  ];
  check("2 same day -> none dropped", [...unscoredGymIds(acts)], []);
}
{
  // Input order must not matter — earliest createdAt always wins.
  const acts = [
    gym("g3", "a", "2026-08-10", "2026-08-10T18:00:00Z"),
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T12:00:00Z"),
  ];
  check("input order irrelevant", [...unscoredGymIds(acts)], ["g3"]);
}
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "a", "2026-08-11", "2026-08-11T08:00:00Z"),
    gym("g3", "a", "2026-08-12", "2026-08-12T08:00:00Z"),
  ];
  check("spread across days -> none dropped", [...unscoredGymIds(acts)], []);
}
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T08:00:00Z"),
    gym("g2", "b", "2026-08-10", "2026-08-10T09:00:00Z"),
    gym("g3", "c", "2026-08-10", "2026-08-10T10:00:00Z"),
  ];
  check("different athletes -> none dropped", [...unscoredGymIds(acts)], []);
}
{
  check("runs are never capped", [...unscoredGymIds([
    run("r1", "a", "2026-08-10", 10),
    run("r2", "a", "2026-08-10", 10),
    run("r3", "a", "2026-08-10", 10),
    run("r4", "a", "2026-08-10", 10),
  ])], []);
}

console.log("\nstandingsForRange applies the cap");
{
  const athletes = [ath("a", "Ann"), ath("b", "Bob")];
  // Ann spams 5 gym in a day (would be 150 pts uncapped); Bob runs 10km = 50 pts.
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T01:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T02:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T03:00:00Z"),
    gym("g4", "a", "2026-08-10", "2026-08-10T04:00:00Z"),
    gym("g5", "a", "2026-08-10", "2026-08-10T05:00:00Z"),
    run("r1", "b", "2026-08-10", 10),
  ];
  const st = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const ann = st.find((s) => s.athlete.id === "a")!;
  const bob = st.find((s) => s.athlete.id === "b")!;
  check("gym spam capped at 2x30=60", ann.points, 60);
  check("bob 10km run = 50", bob.points, 50);
  check("all 5 still counted as sessions", ann.sessions, 5);
  check("3 marked unscored", ann.unscoredSessions, 3);
  check("ann still leads 60 > 50", ann.rank, 1);
  check("strava session counted for bob", bob.stravaSessions, 1);
  check("ann has no strava sessions", ann.stravaSessions, 0);
}
{
  // The cap must be computed before range filtering, so a week view and a
  // single-day view agree on which workouts scored.
  const athletes = [ath("a", "Ann")];
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T01:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T02:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T03:00:00Z"),
  ];
  const week = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const day = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-10"]);
  check("week view = 60", week[0].points, 60);
  check("day view agrees = 60", day[0].points, 60);
}

console.log("\ntotalPoints applies the cap");
{
  const acts = [
    gym("g1", "a", "2026-08-10", "2026-08-10T01:00:00Z"),
    gym("g2", "a", "2026-08-10", "2026-08-10T02:00:00Z"),
    gym("g3", "a", "2026-08-10", "2026-08-10T03:00:00Z"),
  ];
  check("3 gym -> 60 not 90", totalPoints(acts, S), 60);
}

console.log("\nadmin grants: awarded points, not a session");
{
  const athletes = [ath("a", "Ann"), ath("b", "Bob")];
  // Ann runs 10km = 50 pts, then the admin tops her up 50 to clear a 100 quota.
  const acts = [
    run("r1", "a", "2026-08-10", 10),
    grant("gr1", "a", "2026-08-10", 50),
    run("r2", "b", "2026-08-10", 4), // 20 pts
  ];
  const st = standingsForRange(athletes, acts, S, ["2026-08-10", "2026-08-16"]);
  const ann = st.find((s) => s.athlete.id === "a")!;
  check("grant lifts the total 50+50=100", ann.points, 100);
  check("grantedPoints tracked separately", ann.grantedPoints, 50);
  check("grant is not counted as a session", ann.sessions, 1);
  check("grant doesn't touch the sport split", ann.bySport.run, 50);
  check("grant doesn't add distance km", ann.km, 10);
  check("topped-up Ann now leads the week", ann.rank, 1);
  check("goalProgress reflects the grant (100/100)", ann.goalProgress, 1);
  // A grant counts everywhere points do, including totalPoints.
  check("totalPoints includes the grant", totalPoints(acts, S), 120);
}
{
  // Grants land in the season the same as any dated activity.
  const S2 = { ...S, seasonStart: "2026-08-03" };
  const athletes = [ath("j", "Jona"), ath("r", "Ryan")];
  const acts = [
    run("in", "r", "2026-08-05", 4), // Ryan 20 pts
    grant("g", "j", "2026-08-05", 30), // admin awards Jona 30 in-season
  ];
  const champs = seasonChampions(athletes, acts, S2, "2026-08-06", "2026-08-03");
  const live = champs.find((c) => c.status === "live")!;
  check("granted points count toward the season lead", live.champion?.athlete.name, "Jona");
  check("season champion's total includes the grant", live.champion?.points, 30);
}

console.log("\nseason window starts at kickoff, not the 1st");
{
  // Seasons are month-aligned (Aug–Sep) but the league opens Mon 3 Aug. The
  // warm-up days before kickoff must not score into Season 1, or whoever
  // logged on the 1st leads a season that hasn't started.
  const S2 = { ...S, seasonStart: "2026-08-03" };
  const s1 = seasonByNumber(1, "2026-08-03");
  check("season 1 opens on the kickoff", s1.start, "2026-08-03");
  check("season 1 still ends with its month block", s1.end, "2026-09-30");
  check("season 1 is still labelled Aug–Sep", s1.monthsLabel, "Aug–Sep");
  // Later seasons are pure month blocks — no kickoff to respect.
  check("season 2 starts on the 1st", seasonByNumber(2, "2026-08-03").start, "2026-10-01");

  const athletes = [ath("j", "Jona"), ath("r", "Ryan")];
  const acts = [
    run("pre", "j", "2026-08-01", 3.353), // warm-up, before kickoff
    { ...run("pre2", "j", "2026-08-01", 0), sport: "swim" as const, km: 0.4, id: "pre2" },
    run("in", "r", "2026-08-05", 4), // after kickoff
  ];
  const champs = seasonChampions(athletes, acts, S2, "2026-08-06", "2026-08-03");
  const live = champs.find((c) => c.status === "live")!;
  check("pre-kickoff logs don't win the season", live.champion?.athlete.name, "Ryan");
  check("champion's points exclude warm-up", live.champion?.points, 20);
}

console.log(failures === 0 ? "\nAll passed.\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
