/**
 * Every date in this app is a local calendar day string (`YYYY-MM-DD`), never a
 * timestamp. Five friends in the same time zone care about "did I ride today",
 * not about UTC instants — and date-only strings make the week/month buckets
 * exact instead of off-by-one near midnight.
 */

export type DayKey = string; // YYYY-MM-DD

export function toDayKey(d: Date): DayKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The league's day rollover, in hours after midnight.
 *
 * Midnight, Montreal time, for everyone — Ryan's call 2026-09-27, replacing a
 * 3 AM grace window. A session finished at 1 AM Monday now counts for Monday,
 * the way the calendar says. The rule is easier to hold in your head, and the
 * two clocks below can no longer disagree.
 *
 * It only ever shifts a session BACKWARD. Nothing can be pushed into a later
 * day, so raising this again stays safe.
 */
export const RESET_HOUR = 0;

/**
 * Two clocks, kept as separate functions even though they now agree.
 *
 * `viewDayAt` is the calendar day the app SHOWS. `logDayAt` is the day a session
 * finished *now* is filed under. At `RESET_HOUR = 0` they are the same answer:
 * midnight ends the day for both the board and the scoring.
 *
 * They stay apart because the grace window is a setting, not a law — the whole
 * app already asks the right one of the two, so putting the window back is a
 * one-line change rather than an audit of every call site.
 *
 * Both take an explicit instant so the behaviour is testable without mocking the
 * clock; the zero-argument wrappers below are what the app calls.
 */
export function viewDayAt(ms: number): DayKey {
  return toDayKey(new Date(ms));
}

export function logDayAt(ms: number): DayKey {
  return toDayKey(new Date(ms - RESET_HOUR * 3_600_000));
}

/** The calendar day right now — what the app SHOWS. */
export function today(): DayKey {
  return viewDayAt(Date.now());
}

/** The day a session logged right now COUNTS for. */
export function logToday(): DayKey {
  return logDayAt(Date.now());
}

/**
 * The city the league keeps time by.
 *
 * On the CLIENT the device clock is the source of truth and these are not used —
 * an athlete's phone knows what day it is. On the SERVER there is no device, and
 * `new Date()` follows whatever zone the container was started in. Railway
 * containers run UTC unless told otherwise, which makes the server's day roll
 * over at 8 PM Montreal: server-rendered markup would show tomorrow's week, and
 * tomorrow's scoring rates, for the last four hours of every evening.
 *
 * Setting TZ on the service fixes that too, but only for as long as nobody
 * forgets it on the next environment. Deriving the day from a named zone in code
 * cannot be forgotten, and makes the correct behaviour a property of the app
 * rather than of its deployment.
 */
export const LEAGUE_TZ = "America/Toronto";

/** The calendar day at `ms` in a named zone, whatever the host's own clock says. */
export function dayKeyInZone(ms: number, timeZone: string): DayKey {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Server-side `today()` — the league's calendar day, not the container's. */
export function leagueToday(): DayKey {
  return dayKeyInZone(Date.now(), LEAGUE_TZ);
}

/** Server-side `logToday()` — the league's scoring day, not the container's. */
export function leagueLogToday(): DayKey {
  return dayKeyInZone(Date.now() - RESET_HOUR * 3_600_000, LEAGUE_TZ);
}

export function isDayKey(v: unknown): v is DayKey {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const probe = new Date(y, m - 1, d);
  return (
    probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d
  );
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Whole days from `from` to `to`; negative when `to` is the earlier one.
 *
 * Rounded, not truncated: a span crossing a daylight-saving boundary is 23 or
 * 25 hours, so the raw division lands just under or just over the integer.
 */
export function daysBetween(from: DayKey, to: DayKey): number {
  const ms = parseDayKey(to).getTime() - parseDayKey(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Monday is day one — the way training weeks are actually counted. */
export function weekStart(key: DayKey): DayKey {
  const d = parseDayKey(key);
  const shift = (d.getDay() + 6) % 7; // Sun(0) -> 6, Mon(1) -> 0
  d.setDate(d.getDate() - shift);
  return toDayKey(d);
}

export function weekEnd(key: DayKey): DayKey {
  return addDays(weekStart(key), 6);
}

export function monthStart(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

export function monthEnd(key: DayKey): DayKey {
  const d = parseDayKey(key);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toDayKey(last);
}

export type Period = "today" | "week" | "month" | "all";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
];

/** Inclusive `[from, to]` day range for a period, relative to `ref`. */
export function periodRange(period: Period, ref: DayKey = today()): [DayKey, DayKey] {
  switch (period) {
    case "today":
      return [ref, ref];
    case "week":
      return [weekStart(ref), weekEnd(ref)];
    case "month":
      return [monthStart(ref), monthEnd(ref)];
    case "all":
      return ["0000-01-01", "9999-12-31"];
  }
}

export function inRange(day: DayKey, [from, to]: [DayKey, DayKey]): boolean {
  return day >= from && day <= to;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDay(key: DayKey): string {
  const d = parseDayKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDayRelative(key: DayKey, ref: DayKey = today()): string {
  if (key === ref) return "Today";
  if (key === addDays(ref, -1)) return "Yesterday";
  return formatDay(key);
}

export function formatRange([from, to]: [DayKey, DayKey]): string {
  const a = parseDayKey(from);
  const b = parseDayKey(to);
  const left = `${a.getDate()} ${MONTHS[a.getMonth()]}`;
  const right = `${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${left} – ${right}`;
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonth(key: DayKey): string {
  const d = parseDayKey(key);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Compact "just now / 5m / 3h / 2d / 1w" from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

/** Inclusive list of month-start keys from `fromKey`'s month to `toKey`'s month. */
export function monthsBetween(fromKey: DayKey, toKey: DayKey): DayKey[] {
  const keys: DayKey[] = [];
  let cur = monthStart(fromKey);
  const last = monthStart(toKey);
  while (cur <= last) {
    keys.push(cur);
    const d = parseDayKey(cur);
    cur = toDayKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  return keys;
}
