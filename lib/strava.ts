import "server-only";
import type { NewActivity, Store, StravaConn, StravaTokens } from "./db";
import { SPORT_UNIT, type Sport } from "./types";

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
  moving_time?: number; // seconds
  elapsed_time?: number; // seconds
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
  if (
    t.includes("weight") ||
    t === "workout" ||
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
 *  `resetHour` is the athlete's day rollover (see `todayWithReset`): at 3, a
 *  1 AM run still belongs to the previous day — and so to the previous week.
 *  A hand-logged session already arrives reset-shifted, because the client
 *  sends its own adjusted "today" as `occurredOn`. Applying the same shift here
 *  is what keeps an auto-synced session on the day it would have landed on had
 *  the athlete typed it in; without it the two paths disagree over exactly the
 *  midnight-to-resetHour window the setting exists for. */
export function activityLocalDay(a: StravaActivity, resetHour = 0): string | null {
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
  resetHour = 0,
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
  return { input: { athleteId, sport, km, occurredOn: day, note }, stravaId: a.id };
}

/** Import a batch for one athlete. Returns the ids of the activities newly logged.
 *  The athlete's reset hour is read here rather than passed in, so no caller can
 *  import a batch that ignores their day rollover. */
export async function importActivities(
  store: Store,
  athleteId: string,
  acts: StravaActivity[],
): Promise<string[]> {
  const resetHour = (await store.getAthlete(athleteId))?.resetHour ?? 0;
  const created: string[] = [];
  for (const a of acts) {
    const mapped = toImport(athleteId, a, resetHour);
    if (!mapped) continue;
    const row = await store.importStravaActivity(mapped.input, mapped.stravaId);
    if (row) created.push(row.id);
  }
  return created;
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
