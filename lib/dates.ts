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
 * The league's day rollover. A session finished before 3 AM belongs to the day —
 * and so the week — that is ending, not the one starting. It is the same hour
 * for everyone, so two people who rode together at 1 AM always score in the same
 * week. Fixed rather than per-athlete: a shared board only reads as fair if a
 * given moment means the same thing on everybody's screen.
 *
 * It only ever shifts a session BACKWARD. Nothing can be pushed into a later day.
 */
export const RESET_HOUR = 3;

/**
 * Two clocks, deliberately kept apart — this is the whole point of the module.
 *
 * `viewDayAt` is the real calendar day. The boards, the week ring and the feed's
 * "Today" follow it, so the new week opens for everyone at midnight, on time.
 *
 * `logDayAt` is the day a session finished *now* should be filed under, and it
 * stays on the old day until RESET_HOUR. So for the first three hours of Monday
 * the board already shows the new week while a 1 AM run still counts toward the
 * week that just ended — which is how a Sunday night is actually lived.
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
