import { LEAGUE_TZ, RESET_HOUR, dayKeyInZone, logDayAt, viewDayAt, weekStart } from "./dates";

/**
 * The two clocks. The board turns over at midnight so the new week opens on
 * time; the scoring day doesn't turn over until RESET_HOUR, so a session
 * finished at 1 AM Monday still counts for the week that just ended.
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

console.log("\nthe rollover is 3 AM");
{
  check("RESET_HOUR is 3", RESET_HOUR, 3);
}

console.log("\nSunday night — nothing has turned over yet");
{
  check("11:30 PM Sun shows Sunday", viewDayAt(at(2026, 8, 30, 23, 30)), SUN);
  check("11:30 PM Sun counts for Sunday", logDayAt(at(2026, 8, 30, 23, 30)), SUN);
}

console.log("\nMidnight to 3 AM Monday — the two clocks disagree, on purpose");
{
  // This is the whole feature: the board has flipped, the points have not.
  check("00:30 Mon SHOWS Monday", viewDayAt(at(2026, 8, 31, 0, 30)), MON);
  check("00:30 Mon COUNTS for Sunday", logDayAt(at(2026, 8, 31, 0, 30)), SUN);
  check("00:30 Mon shows the NEW week",
    weekStart(viewDayAt(at(2026, 8, 31, 0, 30))), NEW_WEEK);
  check("00:30 Mon scores in the OLD week",
    weekStart(logDayAt(at(2026, 8, 31, 0, 30))), OLD_WEEK);

  check("00:00 Mon exactly — board flips on the stroke",
    viewDayAt(at(2026, 8, 31, 0, 0)), MON);
  check("00:00 Mon exactly — still scores as Sunday",
    logDayAt(at(2026, 8, 31, 0, 0)), SUN);

  check("2:59 AM Mon still counts for Sunday", logDayAt(at(2026, 8, 31, 2, 59)), SUN);
}

console.log("\n3 AM Monday onward — the clocks agree again");
{
  check("3:00 AM Mon counts for Monday (rollover is inclusive)",
    logDayAt(at(2026, 8, 31, 3, 0)), MON);
  check("3:00 AM Mon scores in the new week",
    weekStart(logDayAt(at(2026, 8, 31, 3, 0))), NEW_WEEK);
  check("noon Mon shows Monday", viewDayAt(at(2026, 8, 31, 12, 0)), MON);
  check("noon Mon counts for Monday", logDayAt(at(2026, 8, 31, 12, 0)), MON);
}

console.log("\nThe grace applies every night, not just at the week boundary");
{
  // Wed 2026-09-02 at 1 AM belongs to Tuesday — same week either way, so it
  // moves no points; it keeps the feed's day labels matching how it was lived.
  check("1 AM Wed shows Wednesday", viewDayAt(at(2026, 9, 2, 1, 0)), "2026-09-02");
  check("1 AM Wed counts for Tuesday", logDayAt(at(2026, 9, 2, 1, 0)), "2026-09-01");
  check("mid-week grace moves no week",
    weekStart(logDayAt(at(2026, 9, 2, 1, 0))), weekStart(viewDayAt(at(2026, 9, 2, 1, 0))));
}

console.log("\nInvariants across a full day");
{
  // The shift only ever pulls a session BACKWARD, and only before the rollover.
  let bad = 0;
  for (let h = 0; h < 24; h++) {
    const ms = at(2026, 8, 31, h, 0);
    const view = viewDayAt(ms);
    const log = logDayAt(ms);
    if (log > view) bad++; // never pushed into a later day
    const shouldDiffer = h < RESET_HOUR;
    if (shouldDiffer !== (log !== view)) bad++;
    if (shouldDiffer && log !== SUN) bad++;
  }
  check("log day is never later than the view day, and differs only before 3 AM", bad, 0);
}

console.log("\nA month boundary is just another midnight");
{
  // 1 Sep 2026 at 1 AM belongs to 31 Aug — the month board must not claim it.
  check("1 AM on the 1st shows September", viewDayAt(at(2026, 9, 1, 1, 0)), "2026-09-01");
  check("1 AM on the 1st counts for August", logDayAt(at(2026, 9, 1, 1, 0)), "2026-08-31");
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
