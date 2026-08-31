/**
 * The app's own scheduler.
 *
 * Records were supposed to refresh every thirty minutes, driven by a GitHub
 * Actions cron. They didn't: scheduled workflows on shared runners are
 * best-effort, and over one measured day only eight of the ~44 scheduled runs
 * actually fired, with gaps of up to six and a half hours. So a session could
 * sit for most of a day before its personal bests appeared.
 *
 * AmaComp already runs a persistent Node server on Railway, so it can simply
 * tick itself and stop depending on anyone else's scheduler. The GitHub cron is
 * kept as a backup — the tick is idempotent, so both firing is harmless.
 *
 * `register()` runs once when the server starts. It is deliberately quiet about
 * failures: a scheduler that throws must never take the web app down with it.
 */

/** How often the app polls Strava. The thirty minutes the cron only ever
 *  promised — and this one actually keeps it. */
const TICK_MS = 30 * 60 * 1000;

/** A short delay before the first tick so a cold boot serves requests first. */
const FIRST_TICK_MS = 60 * 1000;

export async function register() {
  // Only in the Node server runtime — not during a build, and not on the edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // A build runs the app's modules; it must not start polling Strava.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { runStravaTick } = await import("./lib/tick");

  let running = false;
  async function tick() {
    // A slow tick must not overlap the next one and double the API spend.
    if (running) return;
    running = true;
    try {
      const r = await runStravaTick();
      if (r.imported || r.efforts) {
        console.log(
          `[amacomp] tick: ${r.imported} imported, ${r.efforts} efforts, ${r.athletes} athletes`,
        );
      }
    } catch (err) {
      console.error("[amacomp] tick failed", err);
    } finally {
      running = false;
    }
  }

  setTimeout(() => {
    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    // Don't hold the process open on shutdown.
    timer.unref?.();
  }, FIRST_TICK_MS).unref?.();

  console.log(`[amacomp] scheduler armed — Strava every ${TICK_MS / 60000} min`);
}
