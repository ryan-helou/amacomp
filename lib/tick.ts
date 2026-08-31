import "server-only";
import { getStore } from "./db";
import { readState } from "./state";
import { notifyOvertakes, notifyQuotaHits } from "./push";
import { stravaConfigured, syncAthlete, syncEfforts } from "./strava";

/**
 * The Strava tick: pull each linked athlete's new activities, extract a few
 * personal bests from their streams, and fire the nudges the new sessions earn.
 *
 * Lives here rather than in the route because two things run it — the external
 * cron endpoint, and the app's own scheduler (see `instrumentation.ts`). It is
 * idempotent, so both running is harmless: activities dedupe through the
 * `strava_imports` ledger and efforts through the `strava_efforts` skip list.
 */

/**
 * Stream requests per athlete per tick.
 *
 * Strava allows 100 requests per 15 minutes across an app AmaComp SHARES with
 * Trifecta, and six athletes at ten each is sixty plus a listing call apiece —
 * comfortably inside it. Raised from five when the ticks turned out to be
 * rarer than intended: GitHub Actions was dropping most of the half-hourly
 * schedule, so each tick that did land needed to catch up more.
 */
export const EFFORT_BUDGET_PER_ATHLETE = 10;

export interface TickResult {
  ok: true;
  athletes: number;
  imported: number;
  efforts: number;
  skipped?: string;
}

export async function runStravaTick(): Promise<TickResult> {
  if (!stravaConfigured()) {
    return { ok: true, athletes: 0, imported: 0, efforts: 0, skipped: "strava not configured" };
  }
  const store = getStore();
  const conns = await store.listStravaConns();
  const { seasonStart } = await store.getSettings();
  let athletes = 0;
  let efforts = 0;
  const importedBy = new Map<string, string[]>();

  for (const conn of conns) {
    try {
      const created = await syncAthlete(store, conn, 3);
      if (created.length) importedBy.set(conn.athleteId, created);
      athletes += 1;
    } catch {
      // One dead connection (revoked, rate-limited) shouldn't stop the rest.
    }
    try {
      // Personal bests cost one request per activity, so each tick takes a bite
      // and a backfill finishes over several. Deliberately not on the app-open
      // sync: nobody should wait on Strava to see the leaderboard.
      efforts += await syncEfforts(store, conn, seasonStart, EFFORT_BUDGET_PER_ATHLETE);
    } catch {
      // Same again — a rate-limited or revoked athlete must not stall the rest.
    }
  }

  // Most sessions arrive here rather than through the log form, so this is where
  // the "you just got passed" nudge earns its keep. Read state once, after every
  // athlete has synced, so the standings reflect the full tick.
  let imported = 0;
  if (importedBy.size > 0) {
    const state = await readState();
    for (const [athleteId, ids] of importedBy) {
      imported += ids.length;
      await notifyOvertakes(
        athleteId, state.athletes, state.activities, ids, state.settings,
      ).catch(() => {});
      await notifyQuotaHits(
        athleteId, state.athletes, state.activities, ids, state.settings,
      ).catch(() => {});
    }
  }
  return { ok: true, athletes, imported, efforts };
}
