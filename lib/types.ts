export const SPORTS = ["swim", "bike", "run", "gym"] as const;
export type Sport = (typeof SPORTS)[number];

export function isSport(v: unknown): v is Sport {
  return typeof v === "string" && (SPORTS as readonly string[]).includes(v);
}

/**
 * Swim/bike/run are scored by distance. Gym is flat — one logged workout is
 * worth a fixed number of points, no distance or duration. The stored quantity
 * for a gym log is always 1 (a workout count), so scoring stays generic:
 * points = quantity × multiplier.
 */
export type Unit = "km" | "flat";

export const SPORT_UNIT: Record<Sport, Unit> = {
  swim: "km",
  bike: "km",
  run: "km",
  gym: "flat",
};

export const UNIT_LABEL: Record<Unit, string> = { km: "km", flat: "workout" };
export const UNIT_ABBR: Record<Unit, string> = { km: "km", flat: "ea" };

/** Compact rate label — "25/km" for distance, "30/ea" for a flat per-workout value. */
export function rateLabel(multiplier: number, unit: Unit): string {
  return `${multiplier}/${UNIT_ABBR[unit]}`;
}

/** Compact climb-rate label — "1/100m". Empty string when the sport earns none,
 *  so call sites can drop it from a list without a conditional of their own. */
export function elevationRateLabel(rate: number): string {
  return rate > 0 ? `${rate}/100m` : "";
}

export interface Athlete {
  id: string;
  name: string;
  /** Chosen lane colour (hex from AVATAR_PALETTE), or null to use the default hash.
   *  Still used to tint the feed + back the initials fallback. */
  avatarColor: string | null;
  /** Legacy monochrome glyph pick — superseded by photo avatars, kept for back-compat. */
  avatarGlyph: string | null;
  /** Resolved profile-photo URL: an uploaded image, else the Strava photo, else null
   *  (fall back to coloured initials). The image bytes are served by /api/avatar, not
   *  carried in this payload. */
  avatarUrl: string | null;
  /** Body weight in kg, for the cycling W/kg records. Pulled from the Strava
   *  profile on connect and overridable by hand. `null` means unknown, which is
   *  not the same as light — a rider with no weight gets no W/kg rather than a
   *  made-up one. */
  weightKg: number | null;
}

/**
 * One activity's personal bests, extracted from its Strava streams.
 *
 * Keyed by Strava's activity id rather than ours: `activities` has no
 * `strava_id` column, and the `strava_imports` ledger maps the id to an athlete
 * and nothing else, so there is no way back from a logged row to its source.
 * Carrying the athlete, sport and date here makes the record self-contained.
 */
export interface ActivityEfforts {
  stravaId: number;
  athleteId: string;
  sport: Sport;
  /** Local day, so records can be filtered to the season the same way points are. */
  occurredOn: string;
  /**
   * `"<sport>:<target>"` -> seconds (run/swim) or watts (bike). An activity that
   * produced nothing stores an empty object, which is what stops it from being
   * fetched again on every sync.
   */
  bests: Record<string, number>;
  /** The rider's weight when this was recorded, so a W/kg record stays true to
   *  the day it was set rather than shifting when they next stand on a scale. */
  weightKg: number | null;
}

// Twelve colours the athlete can pick from — deliberately kept apart from the
// sport hues so a lane doesn't read as "the swim lane". Server + client both
// validate against this list so a spoofed request can't inject arbitrary CSS.
export const AVATAR_PALETTE = [
  "#3d5aff", "#e0398a", "#0f9d8f", "#d9761a",
  "#7b3fe4", "#2aa5d6", "#c2384a", "#4b7a2e",
  "#f0a300", "#0aa672", "#e5385f", "#5563a8",
] as const;
export type AvatarColor = (typeof AVATAR_PALETTE)[number];

export function isAvatarColor(v: unknown): v is AvatarColor {
  return typeof v === "string" && (AVATAR_PALETTE as readonly string[]).includes(v);
}

// Subset of GlyphName that reads well at avatar size. Keep this in sync with
// components/Glyph.tsx's GlyphName. Validated server-side.
export const AVATAR_GLYPHS = [
  "bolt", "flame", "star", "drop", "target", "dumbbell", "trophy", "medal",
  "mountain", "flag", "crown", "compass", "moon", "shield", "diamond", "wave",
  "heart", "rocket",
] as const;
export type AvatarGlyph = (typeof AVATAR_GLYPHS)[number];

export function isAvatarGlyph(v: unknown): v is AvatarGlyph {
  return typeof v === "string" && (AVATAR_GLYPHS as readonly string[]).includes(v);
}

/**
 * Where an activity came from — hand-logged, pulled in from Strava, or one of
 * the two admin point-grant kinds. Both grant kinds are the league admin adding
 * points directly (so someone who couldn't complete a week doesn't fall behind
 * on the season): `admin` is a discretionary award of any amount, `excuse` is
 * waiving the week — a top-up to exactly the weekly quota, shown as "excused".
 * Both ride in the activity log so they flow through the same weekly-quota and
 * season aggregation as everything else, but carry a flat `points` amount
 * instead of a distance, and are always rendered as a grant rather than a real
 * session. See `isGrant` / `isExcuse`.
 */
export type ActivitySource = "manual" | "strava" | "admin" | "excuse";

export interface Activity {
  id: string;
  athleteId: string;
  /**
   * For real activities, the discipline. Admin grants carry an inert placeholder
   * here (they have no sport) and are filtered out of all sport/distance/record
   * logic via `isGrant` — read `points`, never `sport`, for a grant.
   */
  sport: Sport;
  /** Kilometres for distance sports; always 1 for a flat gym workout, 0 for a grant. See SPORT_UNIT. */
  km: number;
  /** Local calendar date, `YYYY-MM-DD`. Deliberately date-only: no timezone maths. */
  occurredOn: string;
  note: string | null;
  source: ActivitySource;
  /**
   * A flat points override. Non-null only for admin grants, where it is the
   * awarded amount; null for logged activities, which score from km × multiplier.
   */
  points: number | null;
  /**
   * Metres of ascent, when we know it. Strava reports it per activity; a
   * hand-logged session only has it if the athlete typed it in. `null` means
   * unknown (and so scores no climb points) — deliberately distinct from `0`,
   * which means a genuinely flat session. Always null for grants.
   */
  elevationM: number | null;
  createdAt: string;
}

/** An admin point grant of either kind — awarded points, not a logged session. */
export function isGrant(a: Activity): boolean {
  return a.source === "admin" || a.source === "excuse";
}

/** A grant that waives the week (top-up to quota), shown as "excused". */
export function isExcuse(a: Activity): boolean {
  return a.source === "excuse";
}

/**
 * Grants have no discipline, but the stored `sport` column is non-null. This
 * inert placeholder is written for every grant and never read (all sport/
 * distance/record logic short-circuits on `isGrant` first). Kept as a real
 * distance sport — not "gym" — so nothing ever mistakes a grant for a gym
 * workout against the daily cap.
 */
export const GRANT_SPORT: Sport = "run";

/**
 * A dated change to the scoring rates, applying from `from` (inclusive) onward.
 *
 * Deliberately a PARTIAL override: a change that only names `run` moves run and
 * leaves every other rate exactly as it was. Naming all four would mean a change
 * written today silently re-asserts the other three, so a later correction to
 * bike would be undone by this entry the moment it was applied.
 */
export interface RateChange {
  /** Local day (`YYYY-MM-DD`) the new rates start counting, inclusive. */
  from: string;
  /** Points per km (per workout for gym), for the sports this change touches. */
  multipliers?: Partial<Record<Sport, number>>;
  /** Points per 100 m of ascent, for the sports this change touches. */
  elevationPer100m?: Partial<Record<Sport, number>>;
}

export interface Settings {
  /**
   * The BASE rates — points per km for distance sports, per workout for gym.
   * These are the rates in force from the start of time until the first entry in
   * `rateChanges`. They are not necessarily today's rates: read those with
   * `ratesOn(day, settings)`.
   */
  multipliers: Record<Sport, number>;
  /**
   * Points per 100 m of ascent, per sport. Kept separate from `multipliers`
   * because it is a different unit against a different quantity — a ride earns
   * distance points AND climb points, and the two rates move independently.
   * Only bike is on by default; the others sit at 0, so turning climbing on for
   * running later is a settings change rather than a code change.
   */
  elevationPer100m: Record<Sport, number>;
  /**
   * Rate changes, each applying from its own date forward, oldest first.
   *
   * Points are still derived at read time, but from the rates that were in force
   * on the day the session happened rather than from one global set. That is the
   * difference between "we changed the rules" and "we rewrote what everyone
   * earned": a week already ridden keeps the points it was ridden for, and the
   * forfeit it did or didn't trigger stands.
   */
  rateChanges: RateChange[];
  /** Points every athlete is expected to hit each week. */
  weeklyGoal: number;
  /** The competition only counts sessions on/after this local day (`YYYY-MM-DD`). */
  seasonStart: string;
  /** What the weekly loser owes — shown wherever the stakes come up. */
  forfeit: string;
}

export const DEFAULT_SETTINGS: Settings = {
  multipliers: { swim: 25, bike: 1, run: 5, gym: 30 },
  elevationPer100m: { swim: 0, bike: 1, run: 0, gym: 0 },
  // Ryan's call on 2026-08-30: run drops to 4/km and swim to 15/km from the week
  // of Monday 31 August, with everything before it left exactly as scored.
  //
  // It lives here rather than in a migration because the stored settings row
  // only carries the keys it has ever been saved with, and `mergeSettings` fills
  // the rest from this object — the same route `elevationPer100m` took to
  // production. The first admin save writes it into the row for real. Note this
  // is a PARTIAL change: bike and gym are untouched, so the live 1/km and
  // 5/workout survive even though the base numbers above are stale.
  rateChanges: [{ from: "2026-08-31", multipliers: { run: 4, swim: 15 } }],
  weeklyGoal: 100,
  seasonStart: "2026-08-03",
  forfeit: "Run a marathon — unless the lads excuse you",
};

/** The signed-in athlete's Strava link, surfaced to the client for the settings card. */
export interface StravaStatus {
  /** The server has Strava API credentials — if false, the feature stays hidden. */
  configured: boolean;
  /** This athlete has linked their Strava account. */
  connected: boolean;
  /** ISO timestamp of the last successful pull, or null if never synced. */
  lastSyncAtISO: string | null;
}

export interface AppState {
  me: Athlete | null;
  isAdmin: boolean;
  athletes: Athlete[];
  activities: Activity[];
  settings: Settings;
  strava: StravaStatus;
  /** Personal bests, one entry per Strava activity that produced any. */
  efforts: ActivityEfforts[];
}

export const SPORT_LABEL: Record<Sport, string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  gym: "Gym",
};
