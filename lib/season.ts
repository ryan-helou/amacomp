import type { Activity, Athlete, Settings } from "./types";
import { standingsForRange } from "./scoring";
import { addDays, weekStart, type DayKey } from "./dates";

/**
 * Seasons are two-calendar-month blocks, numbered from Season 1 = the block
 * containing the configured kickoff month (Aug 2026 by default): Season 1 Aug–Sep,
 * Season 2 Oct–Nov, Season 3 Dec–Jan, and so on. Everything is derived from the
 * date — no storage — so the numbering rolls forward on its own.
 *
 * A season ENDS ON A SUNDAY: the one that closes the week its month block ends
 * in, so Aug–Sep runs to Sun 4 Oct rather than Wed 30 Sep, and the next season
 * opens the Monday after. Ryan's call on 2026-09-13.
 *
 * The reason is that everything else here is weekly — the quota, the champion,
 * the streak — so a mid-week boundary splits a single 100-point week across two
 * seasons, and crowns that week's champion days after the season it belonged to
 * has closed. Whole weeks cost the labels a little accuracy (Aug–Sep holds four
 * days of October) and buy a title race that finishes when a week does.
 */

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface SeasonInfo {
  number: number; // 1-based
  label: string; // "Season 1"
  monthsLabel: string; // "Aug–Sep"
  start: DayKey; // "2026-08-01"
  end: DayKey; // "2026-09-30"
}

function ymOf(day: DayKey): { y: number; m: number } {
  const [y, m] = day.split("-").map(Number);
  return { y, m }; // m is 1–12
}
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate(); // m is 1–12

/** The Sunday a season closes on: the end of the week its month block ends in. */
function endOfSeason(n: number, seasonStart: DayKey): DayKey {
  const a = ymOf(seasonStart);
  const endAbs = a.y * 12 + (a.m - 1) + (n - 1) * 2 + 1;
  const ey = Math.floor(endAbs / 12);
  const em = (endAbs % 12) + 1;
  return addDays(weekStart(`${ey}-${pad(em)}-${pad(lastDay(ey, em))}`), 6);
}

export function seasonByNumber(n: number, seasonStart: DayKey): SeasonInfo {
  const a = ymOf(seasonStart);
  const anchorAbs = a.y * 12 + (a.m - 1); // 0-based absolute month index
  const startAbs = anchorAbs + (n - 1) * 2;
  const sy = Math.floor(startAbs / 12);
  const sm = (startAbs % 12) + 1;
  const em = ((startAbs + 1) % 12) + 1; // the block's second month, for the label
  // Season 1 opens on the configured kickoff, not the 1st of its month: the
  // warm-up days before it must not score into the season, or whoever logged on
  // Aug 1 leads a season that hasn't started. Season 1 opens at the kickoff;
  // every later season opens the Monday after
  // the one before it closed, so the seasons tile the calendar with no gap and
  // no overlap even though their ends are pushed out to a Sunday.
  const monthStart = `${sy}-${pad(sm)}-01`;
  const start =
    n === 1
      ? seasonStart > monthStart
        ? seasonStart
        : monthStart
      : addDays(endOfSeason(n - 1, seasonStart), 1);
  return {
    number: n,
    label: `Season ${n}`,
    monthsLabel: `${SHORT_MONTHS[sm - 1]}–${SHORT_MONTHS[em - 1]}`,
    start,
    end: endOfSeason(n, seasonStart),
  };
}

/** The season a day falls in, or null if it's before Season 1 (pre-season). */
export function seasonFor(day: DayKey, seasonStart: DayKey): SeasonInfo | null {
  const a = ymOf(seasonStart);
  const d = ymOf(day);
  const monthsSince = (d.y - a.y) * 12 + (d.m - a.m);
  if (monthsSince < 0) return null;
  // The month block is the first guess; the week-aligned end moves the real
  // boundary by up to six days either side of it, so walk to the season that
  // actually contains the day. The first days of a month can still belong to
  // the season before it — 1–4 Oct 2026 are Season 1.
  let n = Math.floor(monthsSince / 2) + 1;
  while (day > seasonByNumber(n, seasonStart).end) n++;
  while (n > 1 && day < seasonByNumber(n, seasonStart).start) n--;
  return seasonByNumber(n, seasonStart);
}

export function firstSeason(seasonStart: DayKey): SeasonInfo {
  return seasonByNumber(1, seasonStart);
}

/**
 * The day a season opens for the league — the first day that scores into it.
 * `seasonByNumber` already clamps Season 1 to the configured kickoff, so this
 * is just the season's start; it stays as a named accessor because "when does
 * this season open" reads better at the call site than `.start`.
 */
export function seasonOpensOn(season: SeasonInfo): DayKey {
  return season.start;
}

export type SeasonStatus = "past" | "live" | "upcoming";

export interface SeasonChampion {
  season: SeasonInfo;
  champion: { athlete: Athlete; points: number } | null;
  status: SeasonStatus;
}

/** Every season from 1 up to the current one (newest first), with its champion —
 *  the athlete with the most points inside that season's window. Before Season 1
 *  opens, returns just the upcoming Season 1. */
export function seasonChampions(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey,
  seasonStart: DayKey,
): SeasonChampion[] {
  const current = seasonFor(refDay, seasonStart);
  if (!current) {
    return [{ season: firstSeason(seasonStart), champion: null, status: "upcoming" }];
  }
  const out: SeasonChampion[] = [];
  for (let n = current.number; n >= 1; n--) {
    const season = seasonByNumber(n, seasonStart);
    const standings = standingsForRange(athletes, activities, settings, [
      season.start,
      season.end,
    ]);
    const top = standings.find((s) => s.points > 0) ?? null;
    out.push({
      season,
      champion: top ? { athlete: top.athlete, points: top.points } : null,
      status: n === current.number ? "live" : "past",
    });
  }
  return out;
}

/**
 * The reigning champion — winner of the most recent COMPLETED season — who wears
 * gold through the current season. Null before any season has finished (so nobody
 * is gilded during Season 1 or the pre-season).
 */
export function reigningChampionId(
  athletes: Athlete[],
  activities: Activity[],
  settings: Settings,
  refDay: DayKey,
): string | null {
  const past = seasonChampions(athletes, activities, settings, refDay, settings.seasonStart).find(
    (c) => c.status === "past" && c.champion,
  );
  return past?.champion?.athlete.id ?? null;
}
