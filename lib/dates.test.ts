import { LEAGUE_TZ, RESET_HOUR, dayKeyInZone, logDayAt, viewDayAt, weekStart } from "./dates";

/**
 * The two clocks. Both turn over at midnight, Montreal time (RESET_HOUR = 0),
 * so the board and the scoring day always name the same day: a session finished
 * at 1 AM Monday is a Monday session, in the new week.
 *
 * Getting this wrong costs someone a real forfeit — a Sunday-night ride filed
 * into the wrong week can be the difference between hitting quota and owing the
 * marathon — which is why it's tested rather than eyeballed. Run with `npm test`.
 *
 * Every instant here is built with a LOCAL wall clock (`new Date(y, m, d, h, mi)`)
 * and compared against local calendar days, so the suite holds in any time zone.
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

/** A local wall-clock instant. */
function at(y: number, mo: number, d: number, h: number, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi).getTime();
}

// Mon 2026-08-31 starts a week; Sun 2026-08-30 closes the week before it.
const SUN = "2026-08-30";
const MON = "2026-08-31";
const OLD_WEEK = "2026-08-24";
const NEW_WEEK = "2026-08-31";

console.log("\nthe day ends at midnight");
{
  check("RESET_HOUR is 0", RESET_HOUR, 0);
}

console.log("\nSunday night — nothing has turned over yet");
{
  check("11:30 PM Sun shows Sunday", viewDayAt(at(2026, 8, 30, 23, 30)), SUN);
  check("11:30 PM Sun counts for Sunday", logDayAt(at(2026, 8, 30, 23, 30)), SUN);
  check("and scores in the week that is ending",
    weekStart(logDayAt(at(2026, 8, 30, 23, 30))), OLD_WEEK);
}

console.log("\nMidnight Monday — both clocks turn over together");
{
  // The 3 AM grace is gone: a 1 AM Monday run is a Monday run, in the new week.
  check("00:00 Mon exactly shows Monday", viewDayAt(at(2026, 8, 31, 0, 0)), MON);
  check("00:00 Mon exactly counts for Monday", logDayAt(at(2026, 8, 31, 0, 0)), MON);
  check("00:30 Mon counts for Monday", logDayAt(at(2026, 8, 31, 0, 30)), MON);
  check("1 AM Mon scores in the NEW week",
    weekStart(logDayAt(at(2026, 8, 31, 1, 0))), NEW_WEEK);
  check("2:59 AM Mon no longer counts for Sunday",
    logDayAt(at(2026, 8, 31, 2, 59)), MON);
  check("noon Mon counts for Monday", logDayAt(at(2026, 8, 31, 12, 0)), MON);
}

console.log("\nInvariants across a full day");
{
  // The two clocks agree at every hour, and a session is never pushed forward.
  let bad = 0;
  for (let h = 0; h < 24; h++) {
    const ms = at(2026, 8, 31, h, 0);
    const view = viewDayAt(ms);
    const log = logDayAt(ms);
    if (log > view) bad++; // never pushed into a later day
    if (log !== view) bad++; // and at a midnight rollover, never pulled back either
  }
  check("the board and the scoring day agree at every hour", bad, 0);
}

console.log("\nA month boundary is just another midnight");
{
  // 1 Sep 2026 at 1 AM is September for both clocks now.
  check("1 AM on the 1st shows September", viewDayAt(at(2026, 9, 1, 1, 0)), "2026-09-01");
  check("1 AM on the 1st counts for September", logDayAt(at(2026, 9, 1, 1, 0)), "2026-09-01");
  check("11:59 PM on 31 Aug is still August", logDayAt(at(2026, 8, 31, 23, 59)), "2026-08-31");
}

console.log("\nthe server's day is the league's, not the container's");
{
  // 02:00 UTC on Monday 31 August is 22:00 on SUNDAY the 30th in Montreal. A
  // Railway container runs UTC unless told otherwise, so a server that trusts its
  // own clock spends the last four hours of every evening rendering tomorrow —
  // tomorrow's week on the board, and after a rate change, tomorrow's points.
  const lateSunday = Date.parse("2026-08-31T02:00:00Z");
  check("Montreal still calls it Sunday", dayKeyInZone(lateSunday, LEAGUE_TZ), "2026-08-30");
  check("UTC has already rolled over", dayKeyInZone(lateSunday, "Etc/UTC"), "2026-08-31");
  // And so the two disagree about which WEEK it is — the expensive version.
  check("which is a whole week apart", [
    weekStart(dayKeyInZone(lateSunday, LEAGUE_TZ)),
    weekStart(dayKeyInZone(lateSunday, "Etc/UTC")),
  ], ["2026-08-24", "2026-08-31"]);

  // Mid-afternoon the two agree, which is why the bug is invisible most of the day.
  const midday = Date.parse("2026-08-30T16:00:00Z");
  check("at midday they agree", dayKeyInZone(midday, LEAGUE_TZ), "2026-08-30");

  // The whole point: the answer does not depend on the host's own zone, so it
  // cannot regress when someone forgets an environment variable.
  check("the zone argument decides, not the process",
    dayKeyInZone(lateSunday, LEAGUE_TZ), "2026-08-30");
  check("and it survives a date-line zone",
    dayKeyInZone(lateSunday, "Pacific/Kiritimati"), "2026-08-31");
}

console.log(failures === 0 ? "\nAll date tests passed.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
