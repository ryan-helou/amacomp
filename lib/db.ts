import type { Pool as PgPool } from "pg";
import {
  DEFAULT_SETTINGS,
  type Activity,
  type Athlete,
  type Settings,
  type Sport,
} from "./types";

/**
 * Storage. Railway Postgres when DATABASE_URL is set, otherwise an in-memory
 * store so `npm run dev` works on a laptop with nothing installed.
 */

export interface NewActivity {
  athleteId: string;
  sport: Sport;
  km: number;
  occurredOn: string;
  note: string | null;
}

export type ActivityPatch = Partial<Omit<NewActivity, "athleteId">>;

export interface Store {
  init(): Promise<void>;
  findOrCreateAthlete(name: string): Promise<Athlete>;
  getAthlete(id: string): Promise<Athlete | null>;
  listAthletes(): Promise<Athlete[]>;
  listActivities(): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | null>;
  createActivity(input: NewActivity): Promise<Activity>;
  updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null>;
  deleteActivity(id: string): Promise<boolean>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<Settings>;
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Collapse whitespace so "ryan " and "Ryan" are the same person. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function mergeSettings(raw: unknown): Settings {
  const value = (raw ?? {}) as Partial<Settings>;
  const m = (value.multipliers ?? {}) as Partial<Record<Sport, number>>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  return {
    multipliers: {
      swim: num(m.swim, DEFAULT_SETTINGS.multipliers.swim),
      bike: num(m.bike, DEFAULT_SETTINGS.multipliers.bike),
      run: num(m.run, DEFAULT_SETTINGS.multipliers.run),
      gym: num(m.gym, DEFAULT_SETTINGS.multipliers.gym),
    },
    weeklyGoal: num(value.weeklyGoal, DEFAULT_SETTINGS.weeklyGoal),
  };
}

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

const ACTIVITY_COLS = `id, athlete_id, sport, km::float8 AS km,
   to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, note,
   to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`;

type ActivityRow = {
  id: string;
  athlete_id: string;
  sport: Sport;
  km: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
};

function toActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    athleteId: r.athlete_id,
    sport: r.sport,
    km: Number(r.km),
    occurredOn: r.occurred_on,
    note: r.note,
    createdAt: r.created_at,
  };
}

class PgStore implements Store {
  private pool: PgPool;
  private ready: Promise<void> | null = null;

  constructor(pool: PgPool) {
    this.pool = pool;
  }

  init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS athletes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_lower TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            sport TEXT NOT NULL,
            km NUMERIC(10,3) NOT NULL,
            occurred_on DATE NOT NULL,
            note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS activities_occurred_on_idx ON activities (occurred_on)`,
        );
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS activities_athlete_idx ON activities (athlete_id)`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS settings (
            id INT PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `INSERT INTO settings (id, data) VALUES (1, $1::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [JSON.stringify(DEFAULT_SETTINGS)],
        );
      })();
    }
    return this.ready;
  }

  async findOrCreateAthlete(name: string): Promise<Athlete> {
    await this.init();
    const clean = normalizeName(name);
    const lower = clean.toLowerCase();
    const existing = await this.pool.query(
      "SELECT id, name FROM athletes WHERE name_lower = $1",
      [lower],
    );
    if (existing.rows[0]) return existing.rows[0] as Athlete;
    const inserted = await this.pool.query(
      `INSERT INTO athletes (id, name, name_lower) VALUES ($1, $2, $3)
       ON CONFLICT (name_lower) DO UPDATE SET name = athletes.name
       RETURNING id, name`,
      [newId(), clean, lower],
    );
    return inserted.rows[0] as Athlete;
  }

  async getAthlete(id: string): Promise<Athlete | null> {
    await this.init();
    const r = await this.pool.query("SELECT id, name FROM athletes WHERE id = $1", [id]);
    return (r.rows[0] as Athlete) ?? null;
  }

  async listAthletes(): Promise<Athlete[]> {
    await this.init();
    const r = await this.pool.query("SELECT id, name FROM athletes ORDER BY name");
    return r.rows as Athlete[];
  }

  async listActivities(): Promise<Activity[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ${ACTIVITY_COLS} FROM activities ORDER BY occurred_on DESC, created_at DESC`,
    );
    return (r.rows as ActivityRow[]).map(toActivity);
  }

  async getActivity(id: string): Promise<Activity | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ${ACTIVITY_COLS} FROM activities WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? toActivity(r.rows[0] as ActivityRow) : null;
  }

  async createActivity(input: NewActivity): Promise<Activity> {
    await this.init();
    const r = await this.pool.query(
      `INSERT INTO activities (id, athlete_id, sport, km, occurred_on, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${ACTIVITY_COLS}`,
      [newId(), input.athleteId, input.sport, input.km, input.occurredOn, input.note],
    );
    return toActivity(r.rows[0] as ActivityRow);
  }

  async updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null> {
    await this.init();
    const r = await this.pool.query(
      `UPDATE activities SET
         sport = COALESCE($2, sport),
         km = COALESCE($3, km),
         occurred_on = COALESCE($4::date, occurred_on),
         note = CASE WHEN $5::boolean THEN $6 ELSE note END,
         updated_at = now()
       WHERE id = $1
       RETURNING ${ACTIVITY_COLS}`,
      [
        id,
        patch.sport ?? null,
        patch.km ?? null,
        patch.occurredOn ?? null,
        Object.prototype.hasOwnProperty.call(patch, "note"),
        patch.note ?? null,
      ],
    );
    return r.rows[0] ? toActivity(r.rows[0] as ActivityRow) : null;
  }

  async deleteActivity(id: string): Promise<boolean> {
    await this.init();
    const r = await this.pool.query("DELETE FROM activities WHERE id = $1", [id]);
    return (r.rowCount ?? 0) > 0;
  }

  async getSettings(): Promise<Settings> {
    await this.init();
    const r = await this.pool.query("SELECT data FROM settings WHERE id = 1");
    return mergeSettings(r.rows[0]?.data);
  }

  async setSettings(settings: Settings): Promise<Settings> {
    await this.init();
    const r = await this.pool.query(
      `INSERT INTO settings (id, data, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
       RETURNING data`,
      [JSON.stringify(settings)],
    );
    return mergeSettings(r.rows[0]?.data);
  }
}

// ---------------------------------------------------------------------------
// In-memory (local dev with no DATABASE_URL)
// ---------------------------------------------------------------------------

class MemoryStore implements Store {
  private athletes: Athlete[] = [];
  private activities: Activity[] = [];
  private settings: Settings = { ...DEFAULT_SETTINGS };

  async init() {}

  async findOrCreateAthlete(name: string): Promise<Athlete> {
    const clean = normalizeName(name);
    const found = this.athletes.find(
      (a) => a.name.toLowerCase() === clean.toLowerCase(),
    );
    if (found) return found;
    const created = { id: newId(), name: clean };
    this.athletes.push(created);
    return created;
  }

  async getAthlete(id: string) {
    return this.athletes.find((a) => a.id === id) ?? null;
  }

  async listAthletes() {
    return [...this.athletes].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listActivities() {
    return [...this.activities].sort(
      (a, b) =>
        b.occurredOn.localeCompare(a.occurredOn) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  }

  async getActivity(id: string) {
    return this.activities.find((a) => a.id === id) ?? null;
  }

  async createActivity(input: NewActivity): Promise<Activity> {
    const created: Activity = {
      id: newId(),
      athleteId: input.athleteId,
      sport: input.sport,
      km: input.km,
      occurredOn: input.occurredOn,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    this.activities.push(created);
    return created;
  }

  async updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null> {
    const found = this.activities.find((a) => a.id === id);
    if (!found) return null;
    if (patch.sport !== undefined) found.sport = patch.sport;
    if (patch.km !== undefined) found.km = patch.km;
    if (patch.occurredOn !== undefined) found.occurredOn = patch.occurredOn;
    if (Object.prototype.hasOwnProperty.call(patch, "note")) {
      found.note = patch.note ?? null;
    }
    return found;
  }

  async deleteActivity(id: string): Promise<boolean> {
    const i = this.activities.findIndex((a) => a.id === id);
    if (i === -1) return false;
    this.activities.splice(i, 1);
    return true;
  }

  async getSettings() {
    return this.settings;
  }

  async setSettings(settings: Settings) {
    this.settings = mergeSettings(settings);
    return this.settings;
  }
}

// ---------------------------------------------------------------------------

declare global {
  // Survives hot reloads in dev so the in-memory store doesn't reset on save.
  var __amagohStore: Store | undefined;
}

function build(): Store {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[amagoh] DATABASE_URL not set — using in-memory store");
    return new MemoryStore();
  }
  // Required lazily: importing `pg` at module scope pulls it into every bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
  return new PgStore(pool);
}

export function getStore(): Store {
  if (!globalThis.__amagohStore) globalThis.__amagohStore = build();
  return globalThis.__amagohStore;
}
