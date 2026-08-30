import { getStore, type Store, type StravaConn } from "./db";
import { currentAthlete, isAdmin } from "./session";
import { stravaConfigured, syncAthlete } from "./strava";
import type { AppState } from "./types";

/**
 * The whole app is one payload. Five athletes and a season of sessions is a few
 * kilobytes, so the client holds everything and computes leaderboards locally —
 * which makes switching between Today/Week/Month/All-time instant, and lets the
 * device's own calendar decide what "today" means.
 */

// Opening the app for a Strava-connected athlete kicks a background sync if the
// last one was over a minute ago — so activities show up without waiting for the
// 30-min cron and without a "Sync now" tap. Fire-and-forget: the sync races the
// render, so the FIRST paint may still be stale; a reload a second later picks
// it up. A per-athlete in-flight guard + a lastAttempt cooldown keep concurrent
// renders (and a failing connection) from hammering Strava.
const STRAVA_MIN_INTERVAL_MS = 60 * 1000;
const stravaInFlight = new Set<string>();
const stravaLastAttempt = new Map<string, number>();

function maybeBackgroundSyncStrava(store: Store, conn: StravaConn): void {
  if (stravaInFlight.has(conn.athleteId)) return;
  const now = Date.now();
  const lastAttempt = stravaLastAttempt.get(conn.athleteId) ?? 0;
  const lastSuccess = conn.lastSyncAtISO ? Date.parse(conn.lastSyncAtISO) : 0;
  const freshUntil = Math.max(lastAttempt, lastSuccess) + STRAVA_MIN_INTERVAL_MS;
  if (freshUntil > now) return;
  stravaInFlight.add(conn.athleteId);
  stravaLastAttempt.set(conn.athleteId, now);
  void syncAthlete(store, conn, 3)
    .catch(() => {
      /* one bad sync shouldn't crash a page render */
    })
    .finally(() => stravaInFlight.delete(conn.athleteId));
}

export async function readState(): Promise<AppState> {
  const store = getStore();
  const me = await currentAthlete();
  const [athletes, activities, settings, conn, efforts] = await Promise.all([
    store.listAthletes(),
    store.listActivities(),
    store.getSettings(),
    me ? store.getStravaByAthlete(me.id) : Promise.resolve(null),
    store.listEfforts(),
  ]);
  if (conn) maybeBackgroundSyncStrava(store, conn);
  return {
    me,
    isAdmin: isAdmin(me),
    athletes,
    activities,
    settings,
    strava: {
      configured: stravaConfigured(),
      connected: !!conn,
      lastSyncAtISO: conn?.lastSyncAtISO ?? null,
    },
    // A season of bests is a few hundred small numbers, so they ride along with
    // everything else and the Records tab computes locally like every other board.
    efforts,
  };
}
