import type { Activity, Athlete, Settings } from "./types";
import { standingsForRange } from "./scoring";
import type { DayKey } from "./dates";

/**
 * Seasons are two-calendar-month blocks, numbered from Season 1 = the block
 * containing the configured kickoff month (Aug 2026 by default): Season 1 Aug–Sep,
 * Season 2 Oct–Nov, Season 3 Dec–Jan, and so on. Everything is derived from the
 * date — no storage — so the numbering rolls forward on its own.
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

export function seasonByNumber(n: number, seasonStart: DayKey): SeasonInfo {
  const a = ymOf(seasonStart);
  const anchorAbs = a.y * 12 + (a.m - 1); // 0-based absolute month index
  const startAbs = anchorAbs + (n - 1) * 2;
  const sy = Math.floor(startAbs / 12);
  const sm = (startAbs % 12) + 1;
  const endAbs = startAbs + 1;
  const ey = Math.floor(endAbs / 12);
  const em = (endAbs % 12) + 1;
  return {
    number: n,
    label: `Season ${n}`,
    monthsLabel: `${SHORT_MONTHS[sm - 1]}–${SHORT_MONTHS[em - 1]}`,
    start: `${sy}-${pad(sm)}-01`,
    end: `${ey}-${pad(em)}-${pad(lastDay(ey, em))}`,
  };
}

/** The season a day falls in, or null if it's before Season 1 (pre-season). */
export function seasonFor(day: DayKey, seasonStart: DayKey): SeasonInfo | null {
  const a = ymOf(seasonStart);
  const d = ymOf(day);
  const monthsSince = (d.y - a.y) * 12 + (d.m - a.m);
  if (monthsSince < 0) return null;
  return seasonByNumber(Math.floor(monthsSince / 2) + 1, seasonStart);
}

export function firstSeason(seasonStart: DayKey): SeasonInfo {
  return seasonByNumber(1, seasonStart);
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
