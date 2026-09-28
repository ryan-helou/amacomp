import type { Pool as PgPool } from "pg";
import {
  DEFAULT_SETTINGS,
  SPORTS,
  type Activity,
  type ActivitySource,
  type ActivityEfforts,
  type Athlete,
  type GoalChange,
  type RateChange,
  type Settings,
  type Sport,
  type StepDay,
  type StepsLink,
} from "./types";
import { leagueHourNow } from "./dates";

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
  /** Metres of ascent, or null when unknown. See `Activity.elevationM`. */
  elevationM?: number | null;
  /** Moving seconds from Strava, or null when unknown. See `Activity.movingSeconds`. */
  movingSeconds?: number | null;
  /** Hour of day 0-23 in league time, for the quota grace. See `Activity.localHour`. */
  localHour?: number | null;
  /** Open water rather than a pool, for swims. Null when unknown. */
  openWater?: boolean | null;
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
  /** Body weight in kg for the W/kg records; null clears it back to unknown. */
  setWeight(athleteId: string, kg: number | null): Promise<void>;
  // Personal bests, extracted from Strava streams — see lib/efforts.ts.
  listEfforts(): Promise<ActivityEfforts[]>;
  /**
   * The Strava activity ids a sync should skip, so it never pays for the same
   * streams twice.
   *
   * An activity that yielded nothing is skipped too — but only for a while. A
   * ride genuinely has no streams for good, whereas a rate-limited fetch that
   * slipped through as "empty" would otherwise be filed as having set no records
   * forever. Re-examining the empty ones once a day costs almost nothing (nearly
   * every Strava-imported session has streams) and repairs that silently.
   */
  listEffortStravaIds(athleteId: string): Promise<Set<number>>;
  saveEfforts(row: ActivityEfforts): Promise<void>;
  /** Fill in activity names on rows that have none, from the listing the sync
   *  already fetches. One statement, and it never overwrites a name we have. */
  fillEffortNames(pairs: { stravaId: number; name: string }[]): Promise<void>;
  // Push
  savePushSub(athleteId: string, sub: PushSub): Promise<void>;
  deletePushSub(endpoint: string): Promise<void>;
  listPushSubs(): Promise<StoredSub[]>;
  listPushSubsFor(athleteId: string): Promise<PushSub[]>;
  // Small key/value store — used to dedupe scheduled notifications.
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  // Steps — see lib/steps.ts. One row per athlete per day, replaced on report.
  /** Store the hash of an athlete's step code, replacing any earlier one. */
  setStepToken(athleteId: string, tokenHash: string): Promise<void>;
  /** The athlete a step code belongs to (and marks it used), or null. */
  athleteIdForStepToken(tokenHash: string): Promise<string | null>;
  getStepsLink(athleteId: string): Promise<StepsLink>;
  /** Store a personal shortcut and the code baked into it, replacing any earlier code. */
  setStepShortcut(athleteId: string, tokenHash: string, key: string, file: Uint8Array): Promise<void>;
  /** The personal shortcut behind a secret key, or null. */
  getStepShortcut(key: string): Promise<Uint8Array | null>;
  /** Upsert day totals; a day already stored is REPLACED, never added to. */
  upsertStepDays(athleteId: string, days: { day: string; steps: number }[]): Promise<number>;
  listStepDays(): Promise<StepDay[]>;
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Collapse whitespace so "ryan " and "Ryan" are the same person. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Normalise the dated rate changes off a stored settings blob.
 *
 * A malformed entry is DROPPED rather than defaulted: an unreadable rate change
 * has no safe fallback — guessing a number would re-score real weeks — so the
 * only honest reading is that it isn't there. Entries are sorted oldest-first,
 * which is what makes the newest applicable change win in `ratesOn`.
 *
 * Absent entirely (the state of the production row until the first admin save),
 * it falls back to `DEFAULT_SETTINGS.rateChanges` the same way every other key
 * here does.
 */
function mergeRateChanges(raw: unknown): RateChange[] {
  if (!Array.isArray(raw)) return DEFAULT_SETTINGS.rateChanges;
  const rate = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  const partial = (v: unknown): Partial<Record<Sport, number>> | undefined => {
    if (!v || typeof v !== "object") return undefined;
    const src = v as Record<string, unknown>;
    const out: Partial<Record<Sport, number>> = {};
    for (const sport of SPORTS) {
      const n = rate(src[sport]);
      if (n !== undefined) out[sport] = n;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  const changes: RateChange[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const from = e.from;
    if (typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) continue;
    const multipliers = partial(e.multipliers);
    const elevationPer100m = partial(e.elevationPer100m);
    // A change that moves nothing is noise; leaving it in would only make the
    // admin sheet's "what changed when" list harder to read.
    if (!multipliers && !elevationPer100m) continue;
    changes.push({ from, ...(multipliers && { multipliers }), ...(elevationPer100m && { elevationPer100m }) });
  }
  return changes.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Per-athlete weekly goals, read the same way as the rate changes: a malformed
 * entry is dropped rather than guessed, and absent entirely it falls back to the
 * shipped default. Names are kept verbatim — matching is exact on purpose.
 */
function mergeGoalChanges(raw: unknown): GoalChange[] | undefined {
  if (!Array.isArray(raw)) return DEFAULT_SETTINGS.goalChanges;
  const changes: GoalChange[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const from = e.from;
    if (typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) continue;
    if (!e.goals || typeof e.goals !== "object") continue;
    const goals: Record<string, number> = {};
    for (const [name, v] of Object.entries(e.goals as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) goals[name] = v;
    }
    if (Object.keys(goals).length === 0) continue;
    changes.push({ from, goals });
  }
  return changes.sort((a, b) => a.from.localeCompare(b.from));
}

function mergeSettings(raw: unknown): Settings {
  const value = (raw ?? {}) as Partial<Settings>;
  const m = (value.multipliers ?? {}) as Partial<Record<Sport, number>>;
  const e = (value.elevationPer100m ?? {}) as Partial<Record<Sport, number>>;
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
    elevationPer100m: {
      swim: num(e.swim, DEFAULT_SETTINGS.elevationPer100m.swim),
      bike: num(e.bike, DEFAULT_SETTINGS.elevationPer100m.bike),
      run: num(e.run, DEFAULT_SETTINGS.elevationPer100m.run),
      gym: num(e.gym, DEFAULT_SETTINGS.elevationPer100m.gym),
    },
    rateChanges: mergeRateChanges(value.rateChanges),
    goalChanges: mergeGoalChanges(value.goalChanges),
    openWaterPerKm: num(value.openWaterPerKm, DEFAULT_SETTINGS.openWaterPerKm),
    runAscentMetresPerKm: num(
      value.runAscentMetresPerKm, DEFAULT_SETTINGS.runAscentMetresPerKm),
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
   elevation_m::float8 AS elevation_m, open_water, moving_seconds, local_hour,
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
  elevation_m: number | null;
  open_water: boolean | null;
  moving_seconds: number | null;
  local_hour: number | null;
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
    elevationM: r.elevation_m == null ? null : Number(r.elevation_m),
    movingSeconds: r.moving_seconds == null ? null : Number(r.moving_seconds),
    localHour: r.local_hour == null ? null : Number(r.local_hour),
    openWater: r.open_water ?? null,
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
  weight_kg?: string | number | null;
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
  const weight = r.weight_kg === null || r.weight_kg === undefined ? null : Number(r.weight_kg);
  return {
    id: r.id,
    name: r.name,
    // Unknown stays null. A zero or nonsense weight would divide a power record
    // into nonsense, so it is treated as "not set" rather than trusted.
    weightKg: weight !== null && Number.isFinite(weight) && weight > 0 ? weight : null,
    avatarColor: r.avatar_color ?? null,
    avatarGlyph: r.avatar_glyph ?? null,
    avatarUrl,
  };
}

function toEfforts(r: {
  strava_id: string | number;
  athlete_id: string;
  sport: string;
  occurred_on: string;
  bests: unknown;
  weight_kg?: string | number | null;
  name?: string | null;
}): ActivityEfforts {
  const weight = r.weight_kg === null || r.weight_kg === undefined ? null : Number(r.weight_kg);
  const raw = (r.bests ?? {}) as Record<string, unknown>;
  const bests: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    // A stored best that won't parse is dropped rather than defaulted — a made-up
    // number here would be published as somebody's record.
    if (Number.isFinite(n) && n > 0) bests[k] = n;
  }
  return {
    stravaId: Number(r.strava_id),
    athleteId: r.athlete_id,
    sport: r.sport as Sport,
    occurredOn: r.occurred_on,
    bests,
    weightKg: weight !== null && Number.isFinite(weight) && weight > 0 ? weight : null,
    name: r.name ?? null,
  };
}

const ATHLETE_COLS =
  "id, name, weight_kg, avatar_color, avatar_glyph, strava_photo_url, avatar_image_type, avatar_image_v";

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
        // Open water vs pool, for swims. Nullable: unknown is a real state for a
        // hand-logged swim, and it scores as a pool rather than guessing upward.
        await this.pool.query(
          `ALTER TABLE activities ADD COLUMN IF NOT EXISTS open_water BOOLEAN`,
        );
        // Body weight, for the cycling W/kg records. Nullable: unknown is a real
        // and common state, and it must not be confused with a light rider.
        await this.pool.query(
          `ALTER TABLE athletes ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2)`,
        );
        // `athletes.reset_hour` is vestigial: the day rollover is now one fixed
        // hour for the whole league (RESET_HOUR in lib/dates), so nothing reads
        // the column. It is left on the production table rather than dropped —
        // a DROP COLUMN can't be undone and it costs nothing where it sits.
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
        // Metres of ascent. Nullable and NULL by default: rows imported before
        // we captured it are genuinely unknown, not flat, and must not earn
        // climb points retroactively on a number we made up.
        await this.pool.query(
          `ALTER TABLE activities ADD COLUMN IF NOT EXISTS elevation_m NUMERIC(10,1)`,
        );
        // Moving time, Strava only — see `Activity.movingSeconds`.
        await this.pool.query(
          `ALTER TABLE activities ADD COLUMN IF NOT EXISTS moving_seconds INTEGER`,
        );
        // The hour of day a session happened, for the quota grace — see
        // `Activity.localHour`. Everything logged before this column existed is
        // stamped midday: the true hour isn't recorded, and the created_at hour
        // is only the hour someone opened the app. Midday is the one value that
        // cannot reach back and change a week that has already been settled.
        await this.pool.query(
          `ALTER TABLE activities ADD COLUMN IF NOT EXISTS local_hour SMALLINT`,
        );
        await this.pool.query(`UPDATE activities SET local_hour = 12 WHERE local_hour IS NULL`);
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
          CREATE TABLE IF NOT EXISTS strava_efforts (
            strava_id BIGINT PRIMARY KEY,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            sport TEXT NOT NULL,
            occurred_on DATE NOT NULL,
            bests JSONB NOT NULL,
            weight_kg NUMERIC(5,2),
            fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS strava_efforts_athlete_idx ON strava_efforts (athlete_id)`,
        );
        // The activity a record came off. Added later, so existing rows carry
        // null until the sync fills them from its listing.
        await this.pool.query(
          `ALTER TABLE strava_efforts ADD COLUMN IF NOT EXISTS name TEXT`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS strava_imports (
            strava_id BIGINT PRIMARY KEY,
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        // Steps from Apple Health, posted by each athlete's iOS Shortcut.
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS step_tokens (
            athlete_id TEXT PRIMARY KEY REFERENCES athletes(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_used_at TIMESTAMPTZ
          )`);
        // A personal shortcut with the code baked in, fetched by a secret key.
        await this.pool.query(`ALTER TABLE step_tokens ADD COLUMN IF NOT EXISTS shortcut BYTEA`);
        await this.pool.query(`ALTER TABLE step_tokens ADD COLUMN IF NOT EXISTS shortcut_key TEXT UNIQUE`);
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS step_days (
            athlete_id TEXT NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
            day DATE NOT NULL,
            steps INTEGER NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (athlete_id, day)
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
      `INSERT INTO activities (id, athlete_id, sport, km, occurred_on, note, source, points, elevation_m, open_water, moving_seconds, local_hour)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${ACTIVITY_COLS}`,
      [newId(), input.athleteId, input.sport, input.km, input.occurredOn, input.note, source,
       input.points ?? null, input.elevationM ?? null, input.openWater ?? null,
       input.movingSeconds ?? null, input.localHour ?? leagueHourNow()],
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
         elevation_m = CASE WHEN $7::boolean THEN $8 ELSE elevation_m END,
         open_water = CASE WHEN $9::boolean THEN $10 ELSE open_water END,
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
        Object.prototype.hasOwnProperty.call(patch, "elevationM"),
        patch.elevationM ?? null,
        Object.prototype.hasOwnProperty.call(patch, "openWater"),
        patch.openWater ?? null,
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

  async setWeight(athleteId: string, kg: number | null): Promise<void> {
    await this.init();
    await this.pool.query("UPDATE athletes SET weight_kg = $2 WHERE id = $1", [
      athleteId,
      kg,
    ]);
  }

  async listEfforts(): Promise<ActivityEfforts[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT strava_id, athlete_id, sport,
              to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, bests, weight_kg, name
         FROM strava_efforts`,
    );
    return r.rows.map(toEfforts);
  }

  async listEffortStravaIds(athleteId: string): Promise<Set<number>> {
    await this.init();
    const r = await this.pool.query(
      `SELECT strava_id FROM strava_efforts
        WHERE athlete_id = $1
          AND (bests <> '{}'::jsonb OR fetched_at > now() - interval '12 hours')`,
      [athleteId],
    );
    return new Set(r.rows.map((x) => Number(x.strava_id)));
  }

  async saveEfforts(row: ActivityEfforts): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO strava_efforts (strava_id, athlete_id, sport, occurred_on, bests, weight_kg, name)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (strava_id) DO UPDATE
         SET bests = EXCLUDED.bests, weight_kg = EXCLUDED.weight_kg,
             name = COALESCE(EXCLUDED.name, strava_efforts.name), fetched_at = now()`,
      [row.stravaId, row.athleteId, row.sport, row.occurredOn,
       JSON.stringify(row.bests), row.weightKg, row.name],
    );
  }

  async fillEffortNames(pairs: { stravaId: number; name: string }[]): Promise<void> {
    if (pairs.length === 0) return;
    await this.init();
    // A single UPDATE ... FROM (VALUES ...) rather than one statement per
    // activity: the sync calls this every tick with the whole listing.
    const values = pairs
      .map((_, i) => `($${i * 2 + 1}::bigint, $${i * 2 + 2}::text)`)
      .join(", ");
    const params = pairs.flatMap((p) => [p.stravaId, p.name]);
    await this.pool.query(
      `UPDATE strava_efforts e SET name = v.name
         FROM (VALUES ${values}) AS v(strava_id, name)
        WHERE e.strava_id = v.strava_id AND e.name IS NULL`,
      params,
    );
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

  async setStepToken(athleteId: string, tokenHash: string): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO step_tokens (athlete_id, token_hash, created_at, last_used_at)
       VALUES ($1, $2, now(), NULL)
       ON CONFLICT (athlete_id) DO UPDATE
         SET token_hash = EXCLUDED.token_hash, created_at = now(), last_used_at = NULL,
             shortcut = NULL, shortcut_key = NULL`,
      [athleteId, tokenHash],
    );
  }

  async setStepShortcut(athleteId: string, tokenHash: string, key: string, file: Uint8Array): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO step_tokens (athlete_id, token_hash, created_at, last_used_at, shortcut, shortcut_key)
       VALUES ($1, $2, now(), NULL, $4, $3)
       ON CONFLICT (athlete_id) DO UPDATE
         SET token_hash = EXCLUDED.token_hash, created_at = now(), last_used_at = NULL,
             shortcut = EXCLUDED.shortcut, shortcut_key = EXCLUDED.shortcut_key`,
      [athleteId, tokenHash, key, Buffer.from(file)],
    );
  }

  async getStepShortcut(key: string): Promise<Uint8Array | null> {
    await this.init();
    const r = await this.pool.query(`SELECT shortcut FROM step_tokens WHERE shortcut_key = $1`, [key]);
    return r.rows[0]?.shortcut ?? null;
  }

  async athleteIdForStepToken(tokenHash: string): Promise<string | null> {
    await this.init();
    const r = await this.pool.query(
      `UPDATE step_tokens SET last_used_at = now() WHERE token_hash = $1 RETURNING athlete_id`,
      [tokenHash],
    );
    return r.rows[0]?.athlete_id ?? null;
  }

  async getStepsLink(athleteId: string): Promise<StepsLink> {
    await this.init();
    const r = await this.pool.query(
      `SELECT last_used_at, shortcut_key FROM step_tokens WHERE athlete_id = $1`,
      [athleteId],
    );
    const row = r.rows[0];
    return {
      connected: !!row?.last_used_at,
      lastSyncAtISO: row?.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      shortcutKey: row?.shortcut_key ?? null,
    };
  }

  async upsertStepDays(athleteId: string, days: { day: string; steps: number }[]): Promise<number> {
    await this.init();
    if (days.length === 0) return 0;
    const r = await this.pool.query(
      `INSERT INTO step_days (athlete_id, day, steps, updated_at)
       SELECT $1, d::date, s, now() FROM unnest($2::text[], $3::int[]) AS t(d, s)
       ON CONFLICT (athlete_id, day) DO UPDATE SET steps = EXCLUDED.steps, updated_at = now()`,
      [athleteId, days.map((d) => d.day), days.map((d) => d.steps)],
    );
    return r.rowCount ?? days.length;
  }

  async listStepDays(): Promise<StepDay[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT athlete_id, to_char(day, 'YYYY-MM-DD') AS day, steps, updated_at
         FROM step_days ORDER BY day`,
    );
    return r.rows.map((row) => ({
      athleteId: row.athlete_id as string,
      day: row.day as string,
      steps: Number(row.steps),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
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
      weightKg: null,
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
      openWater: input.openWater ?? null,
      source,
      points: input.points ?? null,
      elevationM: input.elevationM ?? null,
      movingSeconds: input.movingSeconds ?? null,
      localHour: input.localHour ?? leagueHourNow(),
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
    if (Object.prototype.hasOwnProperty.call(patch, "elevationM")) {
      found.elevationM = patch.elevationM ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "openWater")) {
      found.openWater = patch.openWater ?? null;
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

  private efforts = new Map<number, ActivityEfforts>(); // strava id → bests

  async setWeight(athleteId: string, kg: number | null) {
    const a = this.athletes.find((x) => x.id === athleteId);
    if (a) a.weightKg = kg;
  }
  async listEfforts() {
    return [...this.efforts.values()];
  }
  async listEffortStravaIds(athleteId: string) {
    // No `fetched_at` here and no real Strava behind it, so the retry window the
    // Postgres store applies has nothing to act on locally.
    return new Set(
      [...this.efforts.values()].filter((e) => e.athleteId === athleteId).map((e) => e.stravaId),
    );
  }
  async saveEfforts(row: ActivityEfforts) {
    this.efforts.set(row.stravaId, row);
  }
  async fillEffortNames(pairs: { stravaId: number; name: string }[]) {
    for (const p of pairs) {
      const e = this.efforts.get(p.stravaId);
      if (e && !e.name) e.name = p.name;
    }
  }

  private subs = new Map<string, StoredSub>(); // endpoint → sub
  private meta = new Map<string, string>();
  private stepTokens = new Map<
    string,
    { athleteId: string; lastUsedAt: string | null; key?: string; file?: Uint8Array }
  >(); // hash → owner
  private stepDays = new Map<string, StepDay>(); // `${athleteId}|${day}` → row

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

  async setStepToken(athleteId: string, tokenHash: string) {
    for (const [hash, v] of this.stepTokens) if (v.athleteId === athleteId) this.stepTokens.delete(hash);
    this.stepTokens.set(tokenHash, { athleteId, lastUsedAt: null });
  }

  async athleteIdForStepToken(tokenHash: string) {
    const v = this.stepTokens.get(tokenHash);
    if (!v) return null;
    v.lastUsedAt = new Date().toISOString();
    return v.athleteId;
  }

  async getStepsLink(athleteId: string) {
    for (const v of this.stepTokens.values()) {
      if (v.athleteId === athleteId) {
        return { connected: !!v.lastUsedAt, lastSyncAtISO: v.lastUsedAt, shortcutKey: v.key ?? null };
      }
    }
    return { connected: false, lastSyncAtISO: null, shortcutKey: null };
  }

  async setStepShortcut(athleteId: string, tokenHash: string, key: string, file: Uint8Array) {
    await this.setStepToken(athleteId, tokenHash);
    Object.assign(this.stepTokens.get(tokenHash)!, { key, file });
  }

  async getStepShortcut(key: string) {
    for (const v of this.stepTokens.values()) if (v.key === key) return v.file ?? null;
    return null;
  }

  async upsertStepDays(athleteId: string, days: { day: string; steps: number }[]) {
    const now = new Date().toISOString();
    for (const d of days) {
      this.stepDays.set(`${athleteId}|${d.day}`, { athleteId, day: d.day, steps: d.steps, updatedAt: now });
    }
    return days.length;
  }

  async listStepDays() {
    return [...this.stepDays.values()].sort((a, b) => a.day.localeCompare(b.day));
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
