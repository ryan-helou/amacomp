import { getStore } from "./db";
import { currentAthlete, isAdmin } from "./session";
import type { AppState } from "./types";

/**
 * The whole app is one payload. Five athletes and a season of sessions is a few
 * kilobytes, so the client holds everything and computes leaderboards locally —
 * which makes switching between Today/Week/Month/All-time instant, and lets the
 * device's own calendar decide what "today" means.
 */
export async function readState(): Promise<AppState> {
  const store = getStore();
  const me = await currentAthlete();
  const [athletes, activities, settings, reactions, comments] = await Promise.all([
    store.listAthletes(),
    store.listActivities(),
    store.getSettings(),
    store.listReactions(),
    store.listComments(),
  ]);
  return { me, isAdmin: isAdmin(me), athletes, activities, settings, reactions, comments };
}
