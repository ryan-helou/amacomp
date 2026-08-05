import type { Pool as PgPool } from "pg";
import {
  DEFAULT_SETTINGS,
  type Activity,
  type ActivitySource,
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
  /** Flat points override — set only when creating an admin grant. */
  points?: number | null;
}

export type ActivityPatch = Partial<Omit<NewActivity, "athleteId">>;

/** A linked Strava account. Tokens live server-side only; never sent to the client. */
export interface StravaConn {
  athleteId: string;
  stravaAthleteId: number;
  accessToken: string;
  refreshToken: string;
  /** Unix seconds — when the access token stops working. */
  expiresAt: number;
  scope: string | null;
  lastSyncAtISO: string | null;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface StravaUpsert {
  athleteId: string;
  stravaAthleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

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
  /** Persist an athlete's avatar picks. Either field may be null to clear it. */
  setAvatar(athleteId: string, color: string | null, glyph: string | null): Promise<void>;
  /** Store an uploaded profile photo (base64, no data: prefix). `version` cache-busts. */
  setAvatarImage(athleteId: string, dataBase64: string, contentType: string, version: number): Promise<void>;
  /** Drop the uploaded photo, reverting to the Strava photo / initials. */
  clearAvatarImage(athleteId: string): Promise<void>;
  /** The raw uploaded photo for the serving endpoint, or null if none. */
  getAvatarImage(athleteId: string): Promise<{ data: string; contentType: string } | null>;
  /** Remember the athlete's Strava profile-photo URL (the default avatar). */
  setStravaPhoto(athleteId: string, url: string | null): Promise<void>;
  listActivities(): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity | null>;
  createActivity(input: NewActivity, source?: ActivitySource): Promise<Activity>;
  updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null>;
  deleteActivity(id: string): Promise<boolean>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<Settings>;
  // Strava
  upsertStrava(input: StravaUpsert): Promise<void>;
  getStravaByAthlete(athleteId: string): Promise<StravaConn | null>;
  listStravaConns(): Promise<StravaConn[]>;
  updateStravaTokens(athleteId: string, t: StravaTokens): Promise<void>;
  touchStravaSync(athleteId: string): Promise<void>;
  deleteStrava(athleteId: string): Promise<void>;
  /** Log a Strava activity once. Returns the new row, or null if already imported. */
  importStravaActivity(input: NewActivity, stravaId: number): Promise<Activity | null>;
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
   to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, note, source, points::float8 AS points,
   to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`;

type ActivityRow = {
  id: string;
  athlete_id: string;
  sport: Sport;
  km: number;
  occurred_on: string;
  note: string | null;
  source: string | null;
  points: number | null;
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
    source: (r.source as ActivitySource) ?? "manual",
    points: r.points == null ? null : Number(r.points),
    createdAt: r.created_at,
  };
}

function toStravaConn(r: {
  athlete_id: string;
  strava_athlete_id: string | number;
  access_token: string;
  refresh_token: string;
  expires_at: string | number;
  scope: string | null;
  last_sync_at: string | null;
}): StravaConn {
  return {
    athleteId: r.athlete_id,
    stravaAthleteId: Number(r.strava_athlete_id),
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Number(r.expires_at),
    scope: r.scope ?? null,
    lastSyncAtISO: r.last_sync_at ?? null,
  };
}

function toAthlete(r: {
  id: string;
  name: string;
  reset_hour?: number;
  avatar_color?: string | null;
  avatar_glyph?: string | null;
  strava_photo_url?: string | null;
  avatar_image_type?: string | null;
  avatar_image_v?: string | number | null;
}): Athlete {
  // An uploaded image wins; otherwise the Strava photo; otherwise null (initials).
  // The `?v=` busts the immutable image cache whenever a new one is uploaded.
  const avatarUrl = r.avatar_image_type
    ? `/api/avatar/${r.id}?v=${r.avatar_image_v ?? 0}`
    : (r.strava_photo_url ?? null);
  // The reset hour used to allow up to 11 AM. When we tightened it to 3, we
  // didn't migrate the DB — clamping on read makes the new cap take effect for
  // anyone still holding an old value, without a destructive UPDATE.
  const rawReset = Number(r.reset_hour ?? 0);
  const resetHour = Math.max(0, Math.min(3, Number.isFinite(rawReset) ? rawReset : 0));
  return {
    id: r.id,
    name: r.name,
    resetHour,
    avatarColor: r.avatar_color ?? null,
    avatarGlyph: r.avatar_glyph ?? null,
    avatarUrl,
  };
}

const ATHLETE_COLS =
  "id, name, reset_hour, avatar_color, avatar_glyph, strava_photo_url, avatar_image_type, avatar_image_v";

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
        // Nullable — a null value means "fall back to the default hash".
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_color TEXT`,
        );
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_glyph TEXT`,
        );
        // Photo avatars: the Strava profile URL (the default), plus metadata for an
        // uploaded image. The image bytes live in a side table so athlete SELECTs
        // stay light. `avatar_image_v` is a version stamp for cache-busting.
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS strava_photo_url TEXT`,
        );
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_image_type TEXT`,
        );
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_image_v BIGINT`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS avatar_images (
            athlete_id TEXT PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
            data TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
        await this.pool.query(
          `ALTER TABLE activities ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`,
        );
        // Flat points override for admin grants; NULL for logged activities.
        await this.pool.query(
          `ALTER TABLE activities ADD COLUMN IF NOT EXISTS points NUMERIC(10,3)`,
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
        // One Strava link per athlete. Tokens stay here, server-side only.
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS strava_connections (
            athlete_id TEXT PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
            strava_athlete_id BIGINT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            expires_at BIGINT NOT NULL,
            scope TEXT,
            connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_sync_at TIMESTAMPTZ
          )`);
        // Ledger of every Strava activity we've already imported. Kept separate
        // from `activities` so deleting an imported log doesn't make the poller
        // re-create it on the next tick.
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS strava_imports (
            strava_id BIGINT PRIMARY KEY,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
      `SELECT ${ATHLETE_COLS} FROM athletes WHERE name_lower = $1`,
      [lower],
    );
    if (existing.rows[0]) return toAthlete(existing.rows[0]);
    const inserted = await this.pool.query(
      `INSERT INTO athletes (id, name, name_lower) VALUES ($1, $2, $3)
       ON CONFLICT (name_lower) DO UPDATE SET name = athletes.name
       RETURNING ${ATHLETE_COLS}`,
      [newId(), clean, lower],
    );
    return toAthlete(inserted.rows[0]);
  }

  async getAthlete(id: string): Promise<Athlete | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ${ATHLETE_COLS} FROM athletes WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? toAthlete(r.rows[0]) : null;
  }

  async listAthletes(): Promise<Athlete[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ${ATHLETE_COLS} FROM athletes ORDER BY name`,
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

  async setAvatar(
    athleteId: string,
    color: string | null,
    glyph: string | null,
  ): Promise<void> {
    await this.init();
    await this.pool.query(
      "UPDATE athletes SET avatar_color = $2, avatar_glyph = $3 WHERE id = $1",
      [athleteId, color, glyph],
    );
  }

  async setAvatarImage(athleteId: string, dataBase64: string, contentType: string, version: number): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO avatar_images (athlete_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (athlete_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [athleteId, dataBase64],
    );
    await this.pool.query(
      "UPDATE athletes SET avatar_image_type = $2, avatar_image_v = $3 WHERE id = $1",
      [athleteId, contentType, version],
    );
  }

  async clearAvatarImage(athleteId: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM avatar_images WHERE athlete_id = $1", [athleteId]);
    await this.pool.query(
      "UPDATE athletes SET avatar_image_type = NULL WHERE id = $1",
      [athleteId],
    );
  }

  async getAvatarImage(athleteId: string): Promise<{ data: string; contentType: string } | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ai.data, a.avatar_image_type
       FROM avatar_images ai JOIN athletes a ON a.id = ai.athlete_id
       WHERE ai.athlete_id = $1`,
      [athleteId],
    );
    const row = r.rows[0];
    if (!row || !row.avatar_image_type) return null;
    return { data: row.data as string, contentType: row.avatar_image_type as string };
  }

  async setStravaPhoto(athleteId: string, url: string | null): Promise<void> {
    await this.init();
    await this.pool.query(
      "UPDATE athletes SET strava_photo_url = $2 WHERE id = $1",
      [athleteId, url],
    );
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

  async createActivity(input: NewActivity, source: ActivitySource = "manual"): Promise<Activity> {
    await this.init();
    const r = await this.pool.query(
      `INSERT INTO activities (id, athlete_id, sport, km, occurred_on, note, source, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${ACTIVITY_COLS}`,
      [newId(), input.athleteId, input.sport, input.km, input.occurredOn, input.note, source, input.points ?? null],
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

  async upsertStrava(input: StravaUpsert): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO strava_connections
         (athlete_id, strava_athlete_id, access_token, refresh_token, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (athlete_id) DO UPDATE SET
         strava_athlete_id = EXCLUDED.strava_athlete_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at,
         scope = EXCLUDED.scope`,
      [
        input.athleteId,
        input.stravaAthleteId,
        input.accessToken,
        input.refreshToken,
        input.expiresAt,
        input.scope,
      ],
    );
  }

  private readonly stravaCols = `athlete_id, strava_athlete_id, access_token, refresh_token,
    expires_at, scope,
    to_char(last_sync_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_sync_at`;

  async getStravaByAthlete(athleteId: string): Promise<StravaConn | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ${this.stravaCols} FROM strava_connections WHERE athlete_id = $1`,
      [athleteId],
    );
    return r.rows[0] ? toStravaConn(r.rows[0]) : null;
  }

  async listStravaConns(): Promise<StravaConn[]> {
    await this.init();
    const r = await this.pool.query(`SELECT ${this.stravaCols} FROM strava_connections`);
    return r.rows.map(toStravaConn);
  }

  async updateStravaTokens(athleteId: string, t: StravaTokens): Promise<void> {
    await this.init();
    await this.pool.query(
      `UPDATE strava_connections
         SET access_token = $2, refresh_token = $3, expires_at = $4
       WHERE athlete_id = $1`,
      [athleteId, t.accessToken, t.refreshToken, t.expiresAt],
    );
  }

  async touchStravaSync(athleteId: string): Promise<void> {
    await this.init();
    await this.pool.query(
      "UPDATE strava_connections SET last_sync_at = now() WHERE athlete_id = $1",
      [athleteId],
    );
  }

  async deleteStrava(athleteId: string): Promise<void> {
    await this.init();
    await this.pool.query("DELETE FROM strava_connections WHERE athlete_id = $1", [
      athleteId,
    ]);
  }

  async importStravaActivity(input: NewActivity, stravaId: number): Promise<Activity | null> {
    await this.init();
    // Claim the id first; if another tick already imported it, back off.
    const ledger = await this.pool.query(
      `INSERT INTO strava_imports (strava_id, athlete_id) VALUES ($1, $2)
       ON CONFLICT (strava_id) DO NOTHING
       RETURNING strava_id`,
      [stravaId, input.athleteId],
    );
    if ((ledger.rowCount ?? 0) === 0) return null;
    return this.createActivity(input, "strava");
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
    const created: Athlete = {
      id: newId(),
      name: clean,
      resetHour: 0,
      avatarColor: null,
      avatarGlyph: null,
      avatarUrl: null,
    };
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

  async setAvatar(athleteId: string, color: string | null, glyph: string | null) {
    const a = this.athletes.find((x) => x.id === athleteId);
    if (a) {
      a.avatarColor = color;
      a.avatarGlyph = glyph;
    }
  }

  private avatarImages = new Map<string, { data: string; contentType: string; version: number }>();
  private stravaPhotos = new Map<string, string | null>();

  private refreshAvatarUrl(athleteId: string) {
    const a = this.athletes.find((x) => x.id === athleteId);
    if (!a) return;
    const img = this.avatarImages.get(athleteId);
    if (img) a.avatarUrl = `/api/avatar/${athleteId}?v=${img.version}`;
    else a.avatarUrl = this.stravaPhotos.get(athleteId) ?? null;
  }

  async setAvatarImage(athleteId: string, dataBase64: string, contentType: string, version: number) {
    this.avatarImages.set(athleteId, { data: dataBase64, contentType, version });
    this.refreshAvatarUrl(athleteId);
  }

  async clearAvatarImage(athleteId: string) {
    this.avatarImages.delete(athleteId);
    this.refreshAvatarUrl(athleteId);
  }

  async getAvatarImage(athleteId: string) {
    const img = this.avatarImages.get(athleteId);
    return img ? { data: img.data, contentType: img.contentType } : null;
  }

  async setStravaPhoto(athleteId: string, url: string | null) {
    this.stravaPhotos.set(athleteId, url);
    this.refreshAvatarUrl(athleteId);
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

  async createActivity(input: NewActivity, source: ActivitySource = "manual"): Promise<Activity> {
    const created: Activity = {
      id: newId(),
      athleteId: input.athleteId,
      sport: input.sport,
      km: input.km,
      occurredOn: input.occurredOn,
      note: input.note,
      source,
      points: input.points ?? null,
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

  private stravaConns = new Map<string, StravaConn>(); // athleteId → conn
  private stravaImports = new Set<number>(); // strava activity ids already logged

  async upsertStrava(input: StravaUpsert) {
    this.stravaConns.set(input.athleteId, {
      athleteId: input.athleteId,
      stravaAthleteId: input.stravaAthleteId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scope: input.scope,
      lastSyncAtISO: this.stravaConns.get(input.athleteId)?.lastSyncAtISO ?? null,
    });
  }
  async getStravaByAthlete(athleteId: string) {
    return this.stravaConns.get(athleteId) ?? null;
  }
  async listStravaConns() {
    return [...this.stravaConns.values()];
  }
  async updateStravaTokens(athleteId: string, t: StravaTokens) {
    const c = this.stravaConns.get(athleteId);
    if (c) {
      c.accessToken = t.accessToken;
      c.refreshToken = t.refreshToken;
      c.expiresAt = t.expiresAt;
    }
  }
  async touchStravaSync(athleteId: string) {
    const c = this.stravaConns.get(athleteId);
    if (c) c.lastSyncAtISO = new Date().toISOString();
  }
  async deleteStrava(athleteId: string) {
    this.stravaConns.delete(athleteId);
  }
  async importStravaActivity(input: NewActivity, stravaId: number): Promise<Activity | null> {
    if (this.stravaImports.has(stravaId)) return null;
    this.stravaImports.add(stravaId);
    return this.createActivity(input, "strava");
  }

  private subs = new Map<string, StoredSub>(); // endpoint → sub
  private meta = new Map<string, string>();

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
