export const SPORTS = ["swim", "bike", "run", "gym"] as const;
export type Sport = (typeof SPORTS)[number];

export function isSport(v: unknown): v is Sport {
  return typeof v === "string" && (SPORTS as readonly string[]).includes(v);
}

/**
 * Swim/bike/run are scored by distance; gym is scored by time on the clock.
 * The stored quantity and its multiplier are generic — only the unit differs.
 */
export type Unit = "km" | "hr";

export const SPORT_UNIT: Record<Sport, Unit> = {
  swim: "km",
  bike: "km",
  run: "km",
  gym: "hr",
};

export const UNIT_LABEL: Record<Unit, string> = { km: "km", hr: "hr" };
export const UNIT_NOUN: Record<Unit, string> = { km: "Distance", hr: "Duration" };

export interface Athlete {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  athleteId: string;
  sport: Sport;
  /** Kilometres for distance sports, hours for gym. See SPORT_UNIT. */
  km: number;
  /** Local calendar date, `YYYY-MM-DD`. Deliberately date-only: no timezone maths. */
  occurredOn: string;
  note: string | null;
  createdAt: string;
}

export interface Settings {
  /** Points earned per unit (km or hr), by sport. */
  multipliers: Record<Sport, number>;
  /** Points every athlete is expected to hit each week. */
  weeklyGoal: number;
}

export const DEFAULT_SETTINGS: Settings = {
  multipliers: { swim: 25, bike: 1, run: 5, gym: 30 },
  weeklyGoal: 75,
};

export interface AppState {
  me: Athlete | null;
  isAdmin: boolean;
  athletes: Athlete[];
  activities: Activity[];
  settings: Settings;
}

export const SPORT_LABEL: Record<Sport, string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  gym: "Gym",
};
