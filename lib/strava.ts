import "server-only";
import type { NewActivity, Store, StravaConn, StravaTokens } from "./db";
import { SPORT_UNIT, type Sport } from "./types";
import { RESET_HOUR } from "./dates";
import { effortsFor, type Streams } from "./efforts";

/**
 * Strava import — OAuth, token refresh, and turning a synced activity into a
 * logged session. AmaComp reuses the same Strava API app as Trifecta (one app
 * per account), so the callback domain has to cover both hosts; see the setup
 * note. Every activity that maps to a discipline becomes a normal log and scores
 * the same as a hand-entered one — no special casing downstream.
 *
 * Deliberately simpler than Trifecta's version: there's no training plan to
 * match against, so we just import. Nothing here touches React, so the routes
 * and the cron poller share it.
 */

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

// read + private activities, so sessions the athlete keeps private still count.
export const STRAVA_SCOPE = "read,activity:read_all";

export function stravaConfigured(): boolean {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

function clientId(): string {
  return process.env.STRAVA_CLIENT_ID || "";
}
function clientSecret(): string {
  return process.env.STRAVA_CLIENT_SECRET || "";
}

// ---- OAuth ----

export function authorizeUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

export interface TokenExchange {
  stravaAthleteId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
  /** The athlete's Strava profile photo, or null if they use Strava's default. */
  photoUrl: string | null;
}

export async function exchangeCode(code: string): Promise<TokenExchange> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  const j = await res.json();
  // Strava serves a generic silhouette URL when the athlete has no photo — treat
  // that as "no photo" so they fall back to coloured initials, not a stock avatar.
  const profile = typeof j.athlete?.profile === "string" ? j.athlete.profile : null;
  const photoUrl = profile && !/avatar\/athlete\//.test(profile) ? profile : null;
  return {
    stravaAthleteId: Number(j.athlete?.id),
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Number(j.expires_at),
    photoUrl,
  };
}

async function refreshTokens(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const j = await res.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Number(j.expires_at),
  };
}

// Strava rotates the refresh token on every refresh, so two concurrent refreshes
// (the poller racing a manual "Sync now") are fatal: the loser persists an
// already-revoked pair and bricks the connection. Single-flight per athlete —
// concurrent callers share one in-flight POST, and the rotated pair is persisted
// before anyone gets the new token. Entries clear on settle so a failure can't
// poison the map.
const inflightRefresh = new Map<string, Promise<StravaTokens>>();

/** A valid access token for the connection, refreshing + persisting if it's
 *  expired or within 60s of it (Strava access tokens live ~6h). */
export async function validAccessToken(store: Store, conn: StravaConn): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (conn.expiresAt - now > 60) return conn.accessToken;
  let refresh = inflightRefresh.get(conn.athleteId);
  if (!refresh) {
    refresh = refreshTokens(conn.refreshToken)
      .then(async (t) => {
        await store.updateStravaTokens(conn.athleteId, t);
        return t;
      })
      .finally(() => inflightRefresh.delete(conn.athleteId));
    inflightRefresh.set(conn.athleteId, refresh);
  }
  const t = await refresh;
  return t.accessToken;
}

// ---- activities ----

export interface StravaActivity {
  id: number;
  name?: string;
  type?: string; // legacy category, e.g. "Run"
  sport_type?: string; // newer + more granular, e.g. "TrailRun"
  start_date?: string; // UTC ISO
  start_date_local?: string; // athlete-local ISO
  utc_offset?: number; // seconds east of UTC
  distance?: number; // meters
  total_elevation_gain?: number; // meters of ascent
  moving_time?: number; // seconds
  elapsed_time?: number; // seconds
  /** `[lat, lng]` where the activity started, or null/absent when it had no GPS
   *  fix. For swims this is the pool/open-water tell — see `isOpenWater`. */
  start_latlng?: [number, number] | null;
}

/**
 * Whether a Strava swim happened in open water rather than a pool.
 *
 * Strava has no sport type for it — both are `Swim` — so this reads the GPS fix.
 * An open water swim CANNOT be measured without one, because the distance IS the
 * line you swam. So coordinates mean open water, and that direction is reliable.
 *
 * THE ABSENCE OF COORDINATES PROVES NOTHING, and this returns null rather than
 * `false` because of it. A swim recorded with GPS off, or in the watch's pool
 * mode, or entered by hand on Strava, has no track and is not a pool. That is
 * not hypothetical: Ryan's 0.5 km on 2026-08-31 came through with no fix and was
 * open water, and calling it a pool understated his week.
 *
 * Null is UNKNOWN, which scores as a pool — the lower rate, so a wrong guess can
 * never inflate anyone — and the log shows it as unconfirmed so the athlete can
 * set it in one tap.
 *
 * Non-swims answer null too: the question is meaningless for them.
 */
export function isOpenWater(a: StravaActivity, sport: Sport | null): boolean | null {
  if (sport !== "swim") return null;
  const ll = a.start_latlng;
  const hasFix =
    Array.isArray(ll) && ll.length === 2 && Number.isFinite(ll[0]) && Number.isFinite(ll[1]);
  return hasFix ? true : null;
}

export async function fetchRecentActivities(
  accessToken: string,
  afterEpoch?: number,
  perPage = 30,
): Promise<StravaActivity[]> {
  const p = new URLSearchParams({ per_page: String(Math.min(perPage, 100)) });
  if (afterEpoch) p.set("after", String(afterEpoch));
  const res = await fetch(`${API_BASE}/athlete/activities?${p.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava list activities failed: ${res.status}`);
  return (await res.json()) as StravaActivity[];
}

// ---- mapping ----

/** Map a Strava activity onto one of our four disciplines, or null for the
 *  things we don't score (walks, hikes, yoga, e-bike, …) so they never sneak in. */
export function sportOf(a: StravaActivity): Sport | null {
  const t = (a.sport_type || a.type || "").toLowerCase();
  if (t.includes("swim")) return "swim";
  if (t.includes("ride") || t.includes("bike") || t === "velomobile" || t.includes("handcycle"))
    return "bike";
  if (t.includes("run")) return "run"; // Run, TrailRun, VirtualRun
  // Gym means a lift. Strava's generic "Workout" is deliberately NOT here: it's
  // the bucket its app drops everything it has no type for into, so volleyball,
  // a squash game and a stretch session all arrive as "Workout" and were being
  // scored as lifts. A real lift comes across as WeightTraining, Crossfit or
  // similar; anything logged as a plain Workout has to be typed in by hand.
  if (
    t.includes("weight") ||
    t.includes("crossfit") ||
    t.includes("strength") ||
    t.includes("highintensity") // Strava's "HighIntensityIntervalTraining"
  )
    return "gym";
  return null;
}

/** Local calendar day (yyyy-mm-dd) the athlete experienced the activity on.
 *  Prefer start_date_local; when only UTC is present, shift by utc_offset so a
 *  7 PM ride doesn't land on tomorrow.
 *
 *  `resetHour` is the league's day rollover (see `RESET_HOUR` / `logDayAt`): at
 *  3, a 1 AM run still belongs to the previous day — and so to the previous
 *  week. A hand-logged session already arrives reset-shifted, because the client
 *  sends its own adjusted log day as `occurredOn`. Applying the same shift here
 *  is what keeps an auto-synced session on the day it would have landed on had
 *  the athlete typed it in; without it the two paths disagree over exactly the
 *  midnight-to-RESET_HOUR window the rule exists for. It defaults to the league
 *  hour rather than to 0 so that forgetting the argument cannot silently file a
 *  session into the wrong week — the parameter stays only so tests can pin it. */
export function activityLocalDay(a: StravaActivity, resetHour = RESET_HOUR): string | null {
  // start_date_local is wall-clock time in the athlete's zone (Strava tags it
  // with a "Z" it doesn't mean). Read the parts and do the arithmetic in UTC so
  // the result never depends on the server's own time zone.
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(a.start_date_local || "");
  if (m) {
    // A date with no clock time gives us nothing to shift — take it as-is.
    if (m[4] === undefined) return `${m[1]}-${m[2]}-${m[3]}`;
    const ms =
      Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - resetHour * 3_600_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (!a.start_date) return null;
  const startMs = Date.parse(a.start_date);
  if (Number.isNaN(startMs)) return null;
  const offsetMs = typeof a.utc_offset === "number" ? a.utc_offset * 1000 : 0;
  return new Date(startMs + offsetMs - resetHour * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

/** Turn a Strava activity into the shape `importStravaActivity` wants, or null
 *  if it isn't a scored discipline (or a distance sport with no distance). */
export function toImport(
  athleteId: string,
  a: StravaActivity,
  resetHour = RESET_HOUR,
): { input: NewActivity; stravaId: number } | null {
  const sport = sportOf(a);
  if (!sport || !a.id) return null;
  const day = activityLocalDay(a, resetHour);
  if (!day) return null;

  const isFlat = SPORT_UNIT[sport] === "flat";
  // Gym is flat (one workout); distance sports carry their kilometres.
  const km = isFlat ? 1 : Math.round(((a.distance ?? 0) / 1000) * 1000) / 1000;
  if (!isFlat && km <= 0) return null; // a distance session with no distance scores nothing

  const name = (a.name || "").trim();
  const note = name ? name.slice(0, 120) : null;
  // Absent (rather than 0) when Strava has no elevation stream for the activity,
  // so an unknown climb stays unknown instead of scoring as flat.
  const elevationM =
    typeof a.total_elevation_gain === "number" && Number.isFinite(a.total_elevation_gain)
      ? Math.max(0, Math.round(a.total_elevation_gain * 10) / 10)
      : null;
  // Moving time rather than elapsed: a ride that sat at traffic lights for ten
  // minutes wasn't a longer ride. Absent when Strava doesn't report it.
  const movingSeconds =
    typeof a.moving_time === "number" && Number.isFinite(a.moving_time) && a.moving_time > 0
      ? Math.round(a.moving_time)
      : null;
  // The hour it started, in the athlete's own zone — Strava tags start_date_local
  // with a "Z" it doesn't mean, so read the characters rather than parsing it.
  const hourMatch = /^\d{4}-\d{2}-\d{2}T(\d{2}):/.exec(a.start_date_local || "");
  const localHour = hourMatch ? Number(hourMatch[1]) % 24 : null;
  return {
    input: {
      athleteId, sport, km, occurredOn: day, note, elevationM, movingSeconds, localHour,
      openWater: isOpenWater(a, sport),
    },
    stravaId: a.id,
  };
}

/** Import a batch for one athlete. Returns the ids of the activities newly logged.
 *  The day rollover is the league's (`RESET_HOUR`), the same one the log form
 *  applies, so a synced session and a typed one land on the same day. */
export async function importActivities(
  store: Store,
  athleteId: string,
  acts: StravaActivity[],
): Promise<string[]> {
  const created: string[] = [];
  for (const a of acts) {
    const mapped = toImport(athleteId, a);
    if (!mapped) continue;
    const row = await store.importStravaActivity(mapped.input, mapped.stravaId);
    if (row) created.push(row.id);
  }
  return created;
}

/**
 * The athlete's body weight in kg from their Strava profile, or null.
 *
 * Only on the DETAILED athlete, which is why this is its own request rather than
 * something read off the token exchange. Strava returns 0 when the athlete never
 * set one; that is "unknown", not "weightless".
 */
export async function fetchAthleteWeight(accessToken: string): Promise<number | null> {
  const res = await fetch(`${API_BASE}/athlete`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { weight?: unknown };
  const kg = Number(j.weight);
  return Number.isFinite(kg) && kg > 0 ? Math.round(kg * 100) / 100 : null;
}

/**
 * The second-by-second streams a personal best is computed from.
 *
 * Returns null only when Strava DEFINITIVELY has no streams — a manually entered
 * ride, or one recorded without GPS. That is an ordinary answer and the caller
 * records it so the activity is never fetched again.
 *
 * Anything else throws. The distinction matters more than it looks: a 429 means
 * "you asked too often", and treating that as "this ride has no data" would
 * permanently file a real ride as having set no records, with nothing to signal
 * it. Rate limits are shared with Trifecta and easy to hit during a backfill, so
 * the failure mode is not hypothetical — a transient error must leave the
 * activity untouched for the next tick to pick up.
 */
export async function fetchStreams(
  accessToken: string,
  stravaId: number,
): Promise<Streams | null> {
  const p = new URLSearchParams({ keys: "time,distance,watts", key_by_type: "true" });
  const res = await fetch(`${API_BASE}/activities/${stravaId}/streams?${p.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  // 404 is Strava saying the activity has no streams. 401/429/5xx are Strava
  // saying it won't tell us right now, which is not the same thing at all.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Strava streams ${res.status}`);
  const j = (await res.json()) as Record<string, { data?: unknown } | undefined>;
  const nums = (key: string): number[] | undefined => {
    const data = j[key]?.data;
    return Array.isArray(data) ? data.map((v) => Number(v)) : undefined;
  };
  const time = nums("time");
  if (!time || time.length < 2) return null;
  return { time, distance: nums("distance"), watts: nums("watts") };
}

/**
 * Fill in personal bests for one athlete, a few activities at a time.
 *
 * Streams are one request per activity, and Strava allows 100 requests every 15
 * minutes across an app that AmaComp shares with Trifecta — so this takes a
 * small budget per run and lets the half-hourly cron finish the backfill over
 * several ticks rather than spending the whole allowance at once and locking
 * both apps out. Everything examined is recorded, including activities that
 * produced nothing, so the same streams are never paid for twice.
 *
 * Only activities from `seasonStart` onward are considered: the records are the
 * league's, and the league started when it started.
 */
export async function syncEfforts(
  store: Store,
  conn: StravaConn,
  seasonStart: string,
  budget = 5,
): Promise<number> {
  const token = await validAccessToken(store, conn);

  // Weight is needed to turn watts into W/kg. Refreshed only when we don't have
  // one, so a hand-typed override isn't overwritten by a stale Strava profile.
  const athlete = await store.getAthlete(conn.athleteId);
  let weightKg = athlete?.weightKg ?? null;
  if (weightKg === null) {
    weightKg = await fetchAthleteWeight(token);
    if (weightKg !== null) await store.setWeight(conn.athleteId, weightKg);
  }

  const afterEpoch = Math.floor(Date.parse(`${seasonStart}T00:00:00Z`) / 1000) - 86400;
  const acts = await fetchRecentActivities(token, afterEpoch, 100);
  const seen = await store.listEffortStravaIds(conn.athleteId);

  // Backfill activity names onto rows extracted before names were stored. The
  // listing is already in hand, so this costs no extra Strava call — only rows
  // that have no name are touched.
  await store
    .fillEffortNames(
      acts
        .filter((a) => a.id && (a.name || "").trim())
        .map((a) => ({ stravaId: a.id as number, name: (a.name as string).trim().slice(0, 120) })),
    )
    .catch(() => {});

  let done = 0;
  for (const a of acts) {
    if (done >= budget) break;
    if (!a.id || seen.has(a.id)) continue;
    const sport = sportOf(a);
    // Gym is flat — one workout, no distance and no curve to extract.
    if (!sport || sport === "gym") continue;
    const day = activityLocalDay(a);
    if (!day || day < seasonStart) continue;

    // A transient failure here throws and ends this athlete's run for the tick,
    // deliberately: it must not be recorded as "examined and empty", and there
    // is no point burning the rest of the budget on an endpoint that is already
    // refusing us. The next tick resumes where this one stopped.
    const streams = await fetchStreams(token, a.id);
    const bests = streams ? effortsFor(sport, streams) : {};
    await store.saveEfforts({
      stravaId: a.id,
      athleteId: conn.athleteId,
      sport,
      occurredOn: day,
      bests,
      name: (a.name || "").trim().slice(0, 120) || null,
      // Pinned at extraction time, so a W/kg record stays true to the day it was
      // set rather than shifting every time the rider steps on a scale.
      weightKg,
    });
    done++;
  }
  return done;
}

/** Pull one athlete's recent activities and import the new ones. Returns the
 *  new activity ids so the caller can fire overtake notifications. */
export async function syncAthlete(
  store: Store,
  conn: StravaConn,
  sinceDays = 3,
): Promise<string[]> {
  const token = await validAccessToken(store, conn);
  const after = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const acts = await fetchRecentActivities(token, after, 40);
  const created = await importActivities(store, conn.athleteId, acts);
  await store.touchStravaSync(conn.athleteId);
  return created;
}
