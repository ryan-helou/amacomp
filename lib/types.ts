import type { DayKey } from "./dates";

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
  /** The Strava activity's name. A record reads very differently when you can
   *  see it came off "Brutal interval" rather than just a date. Null on rows
   *  extracted before names were stored; the sync fills those in from the
   *  activity listing it already fetches, so no extra API call. */
  name: string | null;
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
   * Open water rather than a pool, for swims only.
   *
   * `null` is UNKNOWN, and is scored as a pool — the lower rate. A hand-logged
   * swim from before the toggle existed genuinely might be either, and guessing
   * upward would hand out points nobody claimed. Strava-imported swims are
   * classified on the way in.
   */
  openWater: boolean | null;
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
  /**
   * Points per km for an OPEN WATER swim, which is a harder thing than the same
   * distance in a pool — no wall, no line, chop, sighting, cold.
   *
   * Deliberately OUTSIDE `rateChanges` and therefore not dated: Ryan asked for
   * it to apply "for the rest of history and the past", so it is retroactive by
   * instruction. That is the opposite of how every other rate here behaves, and
   * it is safe only because it has never yet lowered anyone's score — see the
   * note on the default. If it is ever cut, it will rewrite finished weeks.
   */
  openWaterPerKm: number;
  /**
   * Metres of ascent on a RUN that count as one kilometre run.
   *
   * Ryan's rule, 2026-09-01: "every hundred metres of elevation counts for one
   * kilometre ran". Expressed as distance rather than as points on purpose — it
   * then scores at whatever the run rate was that day, which is what the rule
   * actually says. At 4 pts/km that is a point per 25 m, exactly as he put it.
   *
   * Retroactive by instruction ("all time, past and future"), so like
   * `openWaterPerKm` it sits OUTSIDE `rateChanges`. Cycling is untouched: it
   * keeps its own flat `elevationPer100m` of 1 point per 100 m.
   *
   * 0 turns it off.
   */
  runAscentMetresPerKm: number;
  /** Points every athlete is expected to hit each week, unless `goalChanges`
   *  lowers or raises it for them. */
  weeklyGoal: number;
  /**
   * Per-athlete weekly goals, dated like `rateChanges` and for the same reason:
   * a week already scored keeps the quota it was scored against, so changing
   * someone's goal can't retroactively hand back a forfeit they earned or take
   * one they didn't.
   *
   * Keyed by EXACT athlete name, like `TRIPS` in lib/away.ts — Jona and Jonah
   * are two different people. A name that matches nobody is simply ignored.
   * Each entry is a partial: it names only the athletes whose goal moves.
   */
  goalChanges?: GoalChange[];
  /** The competition only counts sessions on/after this local day (`YYYY-MM-DD`). */
  seasonStart: string;
  /** What the weekly loser owes — shown wherever the stakes come up. */
  forfeit: string;
}

/** One dated set of per-athlete weekly goals. */
export interface GoalChange {
  /** Inclusive local day (`YYYY-MM-DD`) the goals start applying from. */
  from: string;
  /** Athlete name → their weekly goal in points. */
  goals: Record<string, number>;
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
  // 20/km, retroactive, on Ryan's instruction 2026-08-31. Chosen so the change
  // costs nobody points: swim was already 20/km league-wide until 2026-08-31, so
  // every open water swim in the book was scored at exactly this rate already.
  // It only starts to matter going forward, where pool is 15 and open water 20.
  openWaterPerKm: 20,
  runAscentMetresPerKm: 100,
  weeklyGoal: 100,
  // Ryan's call 2026-09-22: Jonah's week drops to 50, backdated on his
  // instruction to the week of 14 Sep — so the 65 he posted that week clears
  // his quota instead of missing it. Weeks before that keep the 100 they were
  // judged against.
  goalChanges: [{ from: "2026-09-14", goals: { Jonah: 50 } }],
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

/**
 * One athlete's step total for one calendar day, as their iPhone last reported
 * it. Days are Apple Health's days — midnight to midnight on the phone — not the
 * league's 3 AM scoring day, because the total arrives already summed by Health.
 * A later report for the same day REPLACES the earlier one, never adds to it.
 */
export interface StepDay {
  athleteId: string;
  day: DayKey;
  steps: number;
  updatedAt: string;
}

/** Whether the signed-in athlete's phone is sending steps, and when it last did. */
export interface StepsLink {
  /** A report has arrived with their code — not merely that a code exists. */
  connected: boolean;
  lastSyncAtISO: string | null;
  /**
   * The secret path segment for their personal shortcut (code baked in), when
   * one has been made for them — see scripts/make-step-shortcuts.mjs.
   */
  shortcutKey: string | null;
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
  /** Daily step totals for everyone, from Apple Health via the Shortcut. */
  steps: StepDay[];
  /** The signed-in athlete's own step connection. */
  stepsLink: StepsLink;
}

export const SPORT_LABEL: Record<Sport, string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  gym: "Gym",
};
