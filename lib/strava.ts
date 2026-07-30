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
  return {
    stravaAthleteId: Number(j.athlete?.id),
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Number(j.expires_at),
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
 *  7 PM ride doesn't land on tomorrow. */
export function activityLocalDay(a: StravaActivity): string | null {
  const local = (a.start_date_local || "").slice(0, 10);
  if (local) return local;
  if (!a.start_date) return null;
  const startMs = Date.parse(a.start_date);
  if (Number.isNaN(startMs)) return null;
  const offsetMs = typeof a.utc_offset === "number" ? a.utc_offset * 1000 : 0;
  return new Date(startMs + offsetMs).toISOString().slice(0, 10);
}

/** Turn a Strava activity into the shape `importStravaActivity` wants, or null
 *  if it isn't a scored discipline (or a distance sport with no distance). */
export function toImport(
  athleteId: string,
  a: StravaActivity,
): { input: NewActivity; stravaId: number } | null {
  const sport = sportOf(a);
  if (!sport || !a.id) return null;
  const day = activityLocalDay(a);
  if (!day) return null;

  const isFlat = SPORT_UNIT[sport] === "flat";
  // Gym is flat (one workout); distance sports carry their kilometres.
  const km = isFlat ? 1 : Math.round(((a.distance ?? 0) / 1000) * 1000) / 1000;
  if (!isFlat && km <= 0) return null; // a distance session with no distance scores nothing

  const name = (a.name || "").trim();
  const note = name ? name.slice(0, 120) : null;
  return { input: { athleteId, sport, km, occurredOn: day, note }, stravaId: a.id };
}

/** Import a batch for one athlete. Returns how many were newly logged. */
export async function importActivities(
  store: Store,
  athleteId: string,
  acts: StravaActivity[],
): Promise<number> {
  let n = 0;
  for (const a of acts) {
    const mapped = toImport(athleteId, a);
    if (!mapped) continue;
    const created = await store.importStravaActivity(mapped.input, mapped.stravaId);
    if (created) n += 1;
  }
  return n;
}

/** Pull one athlete's recent activities and import the new ones. */
export async function syncAthlete(
  store: Store,
  conn: StravaConn,
  sinceDays = 3,
): Promise<number> {
  const token = await validAccessToken(store, conn);
  const after = Math.floor(Date.now() / 1000) - sinceDays * 86400;
  const acts = await fetchRecentActivities(token, after, 40);
  const n = await importActivities(store, conn.athleteId, acts);
  await store.touchStravaSync(conn.athleteId);
  return n;
}
