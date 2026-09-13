import type { Standing } from "./scoring";
import { fmtPoints } from "./scoring";
import { RESET_HOUR } from "./dates";

/**
 * The run-in to the end of a season, as push notifications.
 *
 * Two moments, each sent once per season:
 *   - "soon":  the last few days, so there is still time to do something about it
 *   - "final": the last day itself
 *
 * "soon" is a window rather than a single day on purpose. The scheduler is a
 * daily cron that has been known to skip a run; if the only trigger were
 * "exactly three days left", one missed morning would lose the warning for the
 * whole season. With a window it just lands a day later. The meta marker in the
 * cron job is what keeps it to once.
 */
export type ClosingPhase = "soon" | "final";

export const SOON_DAYS = 3;

export function closingPhase(daysLeft: number): ClosingPhase | null {
  if (daysLeft === 0) return "final";
  if (daysLeft >= 1 && daysLeft <= SOON_DAYS) return "soon";
  return null;
}

export interface ClosingMessage {
  athleteId: string;
  title: string;
  body: string;
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/**
 * One message per athlete, written for where THEY stand — the leader is told
 * what they are defending, everyone else what they have to close.
 *
 * `standings` is the season's table, best first, as `standingsForRange` returns
 * it. Nothing is sent before anyone has scored: a race with no leader has no
 * run-in to talk about.
 */
export function seasonClosingMessages(
  standings: Standing[],
  daysLeft: number,
  seasonLabel: string,
): ClosingMessage[] {
  const phase = closingPhase(daysLeft);
  if (!phase) return [];
  const scored = standings.filter((s) => s.points > 0);
  if (scored.length === 0) return [];

  const leader = scored[0];
  const leaders = scored.filter((s) => s.rank === 1);
  const shared = leaders.length > 1;
  const second = scored.find((s) => s.rank > 1);

  const title = phase === "final" ? `Last day of ${seasonLabel}` : `${seasonLabel} ends Sunday`;
  // The rollover is the detail people get wrong on the last night: a run that
  // finishes at 1 AM Monday still counts for Sunday, and so for this season.
  const clock =
    phase === "final"
      ? ` It closes tonight — anything before ${RESET_HOUR} AM still counts.`
      : ` ${days(daysLeft)} left.`;

  return standings.map((s) => {
    let body: string;
    if (s.points > 0 && s.rank === 1) {
      if (shared) {
        const rivals = leaders.filter((l) => l.athlete.id !== s.athlete.id).map((l) => l.athlete.name);
        body = `You're level at the top with ${rivals.join(" and ")}.${clock}`;
      } else if (second) {
        body = `You lead ${second.athlete.name} by ${fmtPoints(s.points - second.points)} pts.${clock}`;
      } else {
        body = `You're the only one on the board.${clock}`;
      }
    } else {
      const gap = leader.points - s.points;
      const leadName = shared ? leaders.map((l) => l.athlete.name).join(" and ") : leader.athlete.name;
      body =
        s.points > 0
          ? `You're ${ordinal(s.rank)}, ${fmtPoints(gap)} pts off ${leadName}.${clock}`
          : `${leadName} ${shared ? "share" : "leads"} it on ${fmtPoints(leader.points)} pts.${clock}`;
    }
    return { athleteId: s.athlete.id, title, body };
  });
}

function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
