export const SPORTS = ["swim", "bike", "run"] as const;
export type Sport = (typeof SPORTS)[number];

export function isSport(v: unknown): v is Sport {
  return typeof v === "string" && (SPORTS as readonly string[]).includes(v);
}

export interface Athlete {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  athleteId: string;
  sport: Sport;
  km: number;
  /** Local calendar date, `YYYY-MM-DD`. Deliberately date-only: no timezone maths. */
  occurredOn: string;
  note: string | null;
  createdAt: string;
}

export interface Settings {
  /** Points earned per kilometre, by sport. */
  multipliers: Record<Sport, number>;
  /** Points every athlete is expected to hit each week. */
  weeklyGoal: number;
}

export const DEFAULT_SETTINGS: Settings = {
  multipliers: { swim: 25, bike: 1, run: 5 },
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
};
