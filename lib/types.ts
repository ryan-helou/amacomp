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

export interface Athlete {
  id: string;
  name: string;
  /**
   * Hour (0–11, local) at which this athlete's day — and so their week — rolls
   * over. 0 = midnight. Set to 3 for the night owls, so a 2 AM session still
   * counts toward the day/week that's ending.
   */
  resetHour: number;
  /** Chosen lane colour (hex from AVATAR_PALETTE), or null to use the default hash.
   *  Still used to tint the feed + back the initials fallback. */
  avatarColor: string | null;
  /** Legacy monochrome glyph pick — superseded by photo avatars, kept for back-compat. */
  avatarGlyph: string | null;
  /** Resolved profile-photo URL: an uploaded image, else the Strava photo, else null
   *  (fall back to coloured initials). The image bytes are served by /api/avatar, not
   *  carried in this payload. */
  avatarUrl: string | null;
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

/** Where an activity came from — hand-logged or pulled in from Strava. */
export type ActivitySource = "manual" | "strava";

export interface Activity {
  id: string;
  athleteId: string;
  sport: Sport;
  /** Kilometres for distance sports; always 1 for a flat gym workout. See SPORT_UNIT. */
  km: number;
  /** Local calendar date, `YYYY-MM-DD`. Deliberately date-only: no timezone maths. */
  occurredOn: string;
  note: string | null;
  source: ActivitySource;
  createdAt: string;
}

export interface Settings {
  /** Points per km for distance sports; points per workout for gym. */
  multipliers: Record<Sport, number>;
  /** Points every athlete is expected to hit each week. */
  weeklyGoal: number;
  /** The competition only counts sessions on/after this local day (`YYYY-MM-DD`). */
  seasonStart: string;
  /** What the weekly loser owes — shown wherever the stakes come up. */
  forfeit: string;
}

export const DEFAULT_SETTINGS: Settings = {
  multipliers: { swim: 25, bike: 1, run: 5, gym: 30 },
  weeklyGoal: 75,
  seasonStart: "2026-08-10",
  forfeit: "Cook the boys a meal + run a marathon",
};

export const REACTIONS = ["fire", "beast", "respect"] as const;
export type ReactionType = (typeof REACTIONS)[number];

export function isReaction(v: unknown): v is ReactionType {
  return typeof v === "string" && (REACTIONS as readonly string[]).includes(v);
}

export const REACTION_LABEL: Record<ReactionType, string> = {
  fire: "On fire",
  beast: "Beast",
  respect: "Respect",
};

export interface Reaction {
  activityId: string;
  athleteId: string;
  type: ReactionType;
}

export interface Comment {
  id: string;
  activityId: string;
  athleteId: string;
  body: string;
  createdAt: string;
}

export const MAX_COMMENT = 280;

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
  reactions: Reaction[];
  comments: Comment[];
  strava: StravaStatus;
}

export const SPORT_LABEL: Record<Sport, string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  gym: "Gym",
};
