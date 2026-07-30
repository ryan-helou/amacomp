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

export function today(): DayKey {
  return toDayKey(new Date());
}

/**
 * The current day for an athlete whose day rolls over at `resetHour` (local).
 * Shifting "now" back by that many hours means, e.g. with resetHour 3, anything
 * before 3 AM still reads as the previous day.
 */
export function todayWithReset(resetHour: number): DayKey {
  return toDayKey(new Date(Date.now() - resetHour * 3_600_000));
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
