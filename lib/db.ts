import type { Pool as PgPool } from "pg";
import {
  DEFAULT_SETTINGS,
  type Activity,
  type Athlete,
  type Comment,
  type Reaction,
  type ReactionType,
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

/** A browser Web Push subscription (from PushSubscription.toJSON()). */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

export interface StoredSub {
  athleteId: string;
  sub: PushSub;
}

export interface Store {
  init(): Promise<void>;
  findOrCreateAthlete(name: string): Promise<Athlete>;
  getAthlete(id: string): Promise<Athlete | null>;
  listAthletes(): Promise<Athlete[]>;
  setResetHour(athleteId: string, hour: number): Promise<void>;
  listActivities(): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | null>;
  createActivity(input: NewActivity): Promise<Activity>;
  updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null>;
  deleteActivity(id: string): Promise<boolean>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<Settings>;
  // Banter
  setReaction(activityId: string, athleteId: string, type: ReactionType): Promise<void>;
  removeReaction(activityId: string, athleteId: string): Promise<void>;
  listReactions(): Promise<Reaction[]>;
  addComment(activityId: string, athleteId: string, body: string): Promise<Comment>;
  getComment(id: string): Promise<Comment | null>;
  deleteComment(id: string): Promise<void>;
  listComments(): Promise<Comment[]>;
  // Push
  savePushSub(athleteId: string, sub: PushSub): Promise<void>;
  deletePushSub(endpoint: string): Promise<void>;
  listPushSubs(): Promise<StoredSub[]>;
  listPushSubsFor(athleteId: string): Promise<PushSub[]>;
  // Small key/value store — used to dedupe scheduled notifications.
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
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
  const isDay = (v: unknown): v is string =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    multipliers: {
      swim: num(m.swim, DEFAULT_SETTINGS.multipliers.swim),
      bike: num(m.bike, DEFAULT_SETTINGS.multipliers.bike),
      run: num(m.run, DEFAULT_SETTINGS.multipliers.run),
      gym: num(m.gym, DEFAULT_SETTINGS.multipliers.gym),
    },
    weeklyGoal: num(value.weeklyGoal, DEFAULT_SETTINGS.weeklyGoal),
    seasonStart: isDay(value.seasonStart) ? value.seasonStart : DEFAULT_SETTINGS.seasonStart,
    forfeit:
      typeof value.forfeit === "string" && value.forfeit.trim()
        ? value.forfeit.trim().slice(0, 120)
        : DEFAULT_SETTINGS.forfeit,
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

function toAthlete(r: { id: string; name: string; reset_hour?: number }): Athlete {
  return { id: r.id, name: r.name, resetHour: Number(r.reset_hour ?? 0) };
}

function toComment(r: {
  id: string;
  activity_id: string;
  athlete_id: string;
  body: string;
  created_at: string;
}): Comment {
  return {
    id: r.id,
    activityId: r.activity_id,
    athleteId: r.athlete_id,
    body: r.body,
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
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS reset_hour INT NOT NULL DEFAULT 0`,
        );
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
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS push_subs (
            endpoint TEXT PRIMARY KEY,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            sub JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS push_subs_athlete_idx ON push_subs (athlete_id)`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS reactions (
            activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (activity_id, athlete_id)
          )`);
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS comments_activity_idx ON comments (activity_id)`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
      })();
    }
    return this.ready;
  }

  async findOrCreateAthlete(name: string): Promise<Athlete> {
    await this.init();
    const clean = normalizeName(name);
    const lower = clean.toLowerCase();
    const existing = await this.pool.query(
      "SELECT id, name, reset_hour FROM athletes WHERE name_lower = $1",
      [lower],
    );
    if (existing.rows[0]) return toAthlete(existing.rows[0]);
    const inserted = await this.pool.query(
      `INSERT INTO athletes (id, name, name_lower) VALUES ($1, $2, $3)
       ON CONFLICT (name_lower) DO UPDATE SET name = athletes.name
       RETURNING id, name, reset_hour`,
      [newId(), clean, lower],
    );
    return toAthlete(inserted.rows[0]);
  }

  async getAthlete(id: string): Promise<Athlete | null> {
    await this.init();
    const r = await this.pool.query(
      "SELECT id, name, reset_hour FROM athletes WHERE id = $1",
      [id],
    );
    return r.rows[0] ? toAthlete(r.rows[0]) : null;
  }

  async listAthletes(): Promise<Athlete[]> {
    await this.init();
    const r = await this.pool.query(
      "SELECT id, name, reset_hour FROM athletes ORDER BY name",
    );
    return r.rows.map(toAthlete);
  }

  async setResetHour(athleteId: string, hour: number): Promise<void> {
    await this.init();
    await this.pool.query("UPDATE athletes SET reset_hour = $2 WHERE id = $1", [
      athleteId,
      hour,
    ]);
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

  async setReaction(activityId: string, athleteId: string, type: ReactionType): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO reactions (activity_id, athlete_id, type) VALUES ($1, $2, $3)
       ON CONFLICT (activity_id, athlete_id) DO UPDATE SET type = EXCLUDED.type`,
      [activityId, athleteId, type],
    );
  }

  async removeReaction(activityId: string, athleteId: string): Promise<void> {
    await this.init();
    await this.pool.query(
      "DELETE FROM reactions WHERE activity_id = $1 AND athlete_id = $2",
      [activityId, athleteId],
    );
  }

  async listReactions(): Promise<Reaction[]> {
    await this.init();
    const r = await this.pool.query("SELECT activity_id, athlete_id, type FROM reactions");
    return r.rows.map((row) => ({
      activityId: row.activity_id,
      athleteId: row.athlete_id,
      type: row.type as ReactionType,
    }));
  }

  async addComment(activityId: string, athleteId: string, body: string): Promise<Comment> {
    await this.init();
    const r = await this.pool.query(
      `INSERT INTO comments (id, activity_id, athlete_id, body) VALUES ($1, $2, $3, $4)
       RETURNING id, activity_id, athlete_id, body,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [newId(), activityId, athleteId, body],
    );
    return toComment(r.rows[0]);
  }

  async getComment(id: string): Promise<Comment | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT id, activity_id, athlete_id, body,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM comments WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? toComment(r.rows[0]) : null;
  }

  async deleteComment(id: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM comments WHERE id = $1", [id]);
  }

  async listComments(): Promise<Comment[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT id, activity_id, athlete_id, body,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM comments ORDER BY created_at ASC`,
    );
    return r.rows.map(toComment);
  }

  async savePushSub(athleteId: string, sub: PushSub): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO push_subs (endpoint, athlete_id, sub) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (endpoint) DO UPDATE SET athlete_id = EXCLUDED.athlete_id, sub = EXCLUDED.sub`,
      [sub.endpoint, athleteId, JSON.stringify(sub)],
    );
  }

  async deletePushSub(endpoint: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM push_subs WHERE endpoint = $1", [endpoint]);
  }

  async listPushSubs(): Promise<StoredSub[]> {
    await this.init();
    const r = await this.pool.query("SELECT athlete_id, sub FROM push_subs");
    return r.rows.map((row) => ({ athleteId: row.athlete_id, sub: row.sub as PushSub }));
  }

  async listPushSubsFor(athleteId: string): Promise<PushSub[]> {
    await this.init();
    const r = await this.pool.query(
      "SELECT sub FROM push_subs WHERE athlete_id = $1",
      [athleteId],
    );
    return r.rows.map((row) => row.sub as PushSub);
  }

  async getMeta(key: string): Promise<string | null> {
    await this.init();
    const r = await this.pool.query("SELECT value FROM meta WHERE key = $1", [key]);
    return r.rows[0]?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO meta (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
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
    const created = { id: newId(), name: clean, resetHour: 0 };
    this.athletes.push(created);
    return created;
  }

  async getAthlete(id: string) {
    return this.athletes.find((a) => a.id === id) ?? null;
  }

  async listAthletes() {
    return [...this.athletes].sort((a, b) => a.name.localeCompare(b.name));
  }

  async setResetHour(athleteId: string, hour: number) {
    const a = this.athletes.find((x) => x.id === athleteId);
    if (a) a.resetHour = hour;
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

  private reactions: Reaction[] = [];
  private comments: Comment[] = [];
  private subs = new Map<string, StoredSub>(); // endpoint → sub
  private meta = new Map<string, string>();

  async setReaction(activityId: string, athleteId: string, type: ReactionType) {
    const found = this.reactions.find(
      (r) => r.activityId === activityId && r.athleteId === athleteId,
    );
    if (found) found.type = type;
    else this.reactions.push({ activityId, athleteId, type });
  }
  async removeReaction(activityId: string, athleteId: string) {
    this.reactions = this.reactions.filter(
      (r) => !(r.activityId === activityId && r.athleteId === athleteId),
    );
  }
  async listReactions() {
    return [...this.reactions];
  }
  async addComment(activityId: string, athleteId: string, body: string): Promise<Comment> {
    const c: Comment = {
      id: newId(),
      activityId,
      athleteId,
      body,
      createdAt: new Date().toISOString(),
    };
    this.comments.push(c);
    return c;
  }
  async getComment(id: string) {
    return this.comments.find((c) => c.id === id) ?? null;
  }
  async deleteComment(id: string) {
    this.comments = this.comments.filter((c) => c.id !== id);
  }
  async listComments() {
    return [...this.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async savePushSub(athleteId: string, sub: PushSub) {
    this.subs.set(sub.endpoint, { athleteId, sub });
  }
  async deletePushSub(endpoint: string) {
    this.subs.delete(endpoint);
  }
  async listPushSubs() {
    return [...this.subs.values()];
  }
  async listPushSubsFor(athleteId: string) {
    return [...this.subs.values()].filter((s) => s.athleteId === athleteId).map((s) => s.sub);
  }
  async getMeta(key: string) {
    return this.meta.get(key) ?? null;
  }
  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
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
