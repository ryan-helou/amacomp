import { addDays, isDayKey, type DayKey } from "./dates";
import type { Athlete, StepDay } from "./types";

/**
 * Steps, from Apple Health on each athlete's iPhone.
 *
 * A web app cannot read HealthKit, so a free iOS Shortcut does it: it reads the
 * day's step totals and posts them here, run by an automation whenever the
 * athlete opens an app they use all day (the phone is unlocked then, and Apple
 * locks Health data away otherwise). Every watch in the league — Apple Watch,
 * Garmin, Amazfit, Fitbit Air — writes its steps into Apple Health, so this one
 * route covers all of them.
 *
 * This module is the part that has to be lenient and careful: a Shortcut formats
 * numbers and dates the way the phone's locale does, sends whatever shape the
 * user's version of the shortcut builds, and may resend the same days many
 * times a day. So parsing accepts several shapes and every report is an UPSERT
 * of a day's total — sending a day twice can never double it.
 */

/** The name the shared Shortcut is saved under — the app opens it by this name. */
export const STEPS_SHORTCUT_NAME = "AmaComp Steps";
/**
 * The iCloud link to install the shared Shortcut. It has to be built once on a
 * real iPhone (Health actions don't exist on the Mac) — see
 * docs/steps-shortcut.md — then pasted here. Until then Settings explains that
 * the shortcut is on its way instead of offering a dead link.
 */
export const STEPS_SHORTCUT_URL: string | null = null;

/** Anything above this in one day is a mistake or a shaken phone. */
export const MAX_DAILY_STEPS = 150_000;
/** How far back a report may correct. A week covers a phone left off for days. */
export const STEP_DAYS_BACK = 7;
/** How far ahead: a phone a timezone east of the league is a day ahead of it. */
export const STEP_DAYS_AHEAD = 1;
/** A shortcut sends two days; allow a generous resync but not a history dump. */
export const MAX_DAYS_PER_REPORT = 14;

export interface ParsedSteps {
  days: { day: DayKey; steps: number }[];
  /** Entries that were present but unusable — out of window, not a number. */
  rejected: number;
}

/** "8,532", "8 532", 8532.4 and "8532" all mean 8532. */
export function toSteps(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const clean = v.replace(/[\s,  ]/g, "");
    if (clean === "") return null;
    n = Number(clean);
  } else return null;
  if (!Number.isFinite(n) || n < 0 || n > MAX_DAILY_STEPS) return null;
  return Math.round(n);
}

/** "2026-09-15" or an ISO timestamp starting with it. */
function toDay(v: unknown): DayKey | null {
  if (typeof v !== "string") return null;
  const head = v.trim().slice(0, 10);
  return isDayKey(head) ? head : null;
}

/**
 * Read a step report into day totals, relative to the league's `today`.
 *
 * Accepted shapes, because a hand-built Shortcut can produce any of them:
 *   { days: [{ date, steps }] }        — the documented one
 *   { days: [{ day, value }] }         — Health sample field names
 *   { days: { "2026-09-15": 8532 } }   — a dictionary keyed by date
 *   { days: "<one of the above, as a JSON string>" }
 *   [{ date, steps }]                  — a bare list
 *   { date, steps }                    — a single day
 *   { "2026-09-15": 8532, ... }         — the whole body as a date dictionary
 * A date reported twice keeps the last value.
 */
export function parseStepPayload(body: unknown, today: DayKey): ParsedSteps {
  let root: unknown = body;
  if (typeof root === "string") root = tryJson(root);

  let entries: unknown[] = [];
  const obj = root && typeof root === "object" && !Array.isArray(root) ? (root as Record<string, unknown>) : null;
  let days: unknown = Array.isArray(root) ? root : obj?.days;
  if (typeof days === "string") days = tryJson(days);

  const asMap = (o: Record<string, unknown>) =>
    Object.entries(o).map(([date, steps]) => ({ date, steps }));

  if (Array.isArray(days)) {
    entries = days;
  } else if (days && typeof days === "object") {
    entries = asMap(days as Record<string, unknown>);
  } else if (obj && ("date" in obj || "day" in obj)) {
    entries = [obj];
  } else if (obj) {
    // The whole body is a date → steps dictionary — the easiest thing to build
    // with Set Dictionary Value in Shortcuts. Only keys that look like dates
    // count; a stray "token" field is ignored rather than rejected.
    entries = asMap(obj).filter((e) => toDay(e.date) !== null);
  }

  const earliest = addDays(today, -STEP_DAYS_BACK);
  const latest = addDays(today, STEP_DAYS_AHEAD);
  const byDay = new Map<DayKey, number>();
  let rejected = 0;
  for (const e of entries) {
    const rec = e && typeof e === "object" ? (e as Record<string, unknown>) : null;
    const day = toDay(rec?.date ?? rec?.day ?? rec?.startDate);
    const steps = toSteps(rec?.steps ?? rec?.value ?? rec?.count);
    if (!day || steps === null || day < earliest || day > latest) {
      rejected += 1;
      continue;
    }
    byDay.set(day, steps);
  }
  const sorted = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest first
    .slice(0, MAX_DAYS_PER_REPORT)
    .map(([day, steps]) => ({ day, steps }))
    .reverse();
  return { days: sorted, rejected: rejected + Math.max(0, byDay.size - MAX_DAYS_PER_REPORT) };
}

function tryJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export interface StepRow {
  athlete: Athlete;
  /** Steps across the window. */
  steps: number;
  /** Days in the window with any steps reported. */
  days: number;
  /** The best single day in the window. */
  best: number;
  rank: number;
}

/** Everyone ranked by steps across an inclusive day range. Ties share a rank. */
export function stepStandings(
  athletes: Athlete[],
  steps: StepDay[],
  [from, to]: [DayKey, DayKey],
): StepRow[] {
  const acc = new Map<string, { steps: number; days: number; best: number }>();
  for (const a of athletes) acc.set(a.id, { steps: 0, days: 0, best: 0 });
  for (const s of steps) {
    if (s.day < from || s.day > to) continue;
    const r = acc.get(s.athleteId);
    if (!r) continue;
    r.steps += s.steps;
    if (s.steps > 0) r.days += 1;
    r.best = Math.max(r.best, s.steps);
  }
  const rows = athletes
    .map((athlete) => ({ athlete, ...acc.get(athlete.id)!, rank: 0 }))
    .sort((a, b) => b.steps - a.steps || a.athlete.name.localeCompare(b.athlete.name));
  let rank = 0;
  let prev: number | null = null;
  rows.forEach((r, i) => {
    if (prev === null || r.steps !== prev) {
      rank = i + 1;
      prev = r.steps;
    }
    r.rank = rank;
  });
  return rows;
}

/** 12,480 — steps read as a count, so they get separators. */
export function fmtSteps(n: number): string {
  return Math.round(n).toLocaleString("en-CA");
}
