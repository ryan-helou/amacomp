import "server-only";
import webpush from "web-push";
import { getStore, type PushSub } from "./db";
import { fmtPoints, standingsForRange } from "./scoring";
import { periodRange, today } from "./dates";
import type { Activity, Athlete, Settings } from "./types";

/**
 * Web Push fan-out. VAPID keys come from the environment; when they're absent
 * (local dev without keys) the app still runs — pushes just no-op.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@amacomp.app";
  if (pub && priv) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } else {
    configured = false;
  }
  return configured;
}

export function pushEnabled(): boolean {
  return ensureConfigured();
}

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendOne(sub: PushSub, payload: PushPayload): Promise<void> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 mean the subscription is dead — drop it so we stop trying.
    if (status === 404 || status === 410) {
      await getStore().deletePushSub(sub.endpoint).catch(() => {});
    }
  }
}

/** Send to every device an athlete has registered. Fire-and-forget friendly. */
export async function sendToAthlete(
  athleteId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await getStore().listPushSubsFor(athleteId);
  await Promise.all(subs.map((s) => sendOne(s, payload)));
}

/** Send to a set of athletes (deduped). */
export async function sendToAthletes(
  athleteIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;
  const unique = [...new Set(athleteIds)];
  await Promise.all(unique.map((id) => sendToAthlete(id, payload)));
}

/**
 * When `actor` logs sessions this week, notify anyone they leapfrogged on the
 * weekly board — the drama that pulls people back in. Compares the standings
 * with and without the new activities.
 *
 * Takes a batch because a Strava poll can import several rides at once: one
 * before/after comparison across the whole batch means the person who got
 * passed hears about it once, not once per ride.
 */
export async function notifyOvertakes(
  actorId: string,
  athletes: Athlete[],
  allActivities: Activity[],
  newActivityIds: string[],
  settings: Settings,
): Promise<void> {
  if (!ensureConfigured()) return;
  if (newActivityIds.length === 0) return;
  const range = periodRange("week", today());
  const fresh = new Set(newActivityIds);
  // Only an activity inside the current week can move the weekly board.
  const movesThisWeek = allActivities.some(
    (a) => fresh.has(a.id) && a.occurredOn >= range[0] && a.occurredOn <= range[1],
  );
  if (!movesThisWeek) return;

  const before = allActivities.filter((a) => !fresh.has(a.id));
  const aRank = new Map(
    standingsForRange(athletes, allActivities, settings, range).map((s) => [s.athlete.id, s.rank]),
  );
  const bRank = new Map(
    standingsForRange(athletes, before, settings, range).map((s) => [s.athlete.id, s.rank]),
  );
  const actor = athletes.find((a) => a.id === actorId);
  if (!actor) return;

  const passed = athletes.filter(
    (x) =>
      x.id !== actorId &&
      (bRank.get(actorId) ?? 0) > (bRank.get(x.id) ?? 0) &&
      (aRank.get(actorId) ?? 0) < (aRank.get(x.id) ?? 0),
  );

  await Promise.all(
    passed.map((x) => {
      // Losing the #1 spot is the loudest event on the board — call it out
      // instead of using the generic "overtook you" copy.
      const lostLead = bRank.get(x.id) === 1;
      return sendToAthlete(
        x.id,
        lostLead
          ? {
              title: "You lost the lead",
              body: `${actor.name} just took #1 off you. Get it back.`,
              url: "/",
              tag: "lost-lead",
            }
          : {
              title: "You just got passed",
              body: `${actor.name} overtook you — you're #${aRank.get(x.id)} this week now.`,
              url: "/",
              tag: "overtake",
            },
      );
    }),
  );
}

/**
 * When `actor` crosses the weekly quota (100 pts at the time of writing) for
 * the first time this week, tell the whole league. Deduped per athlete per
 * week via the meta store, so re-edits or a repeat sync can't re-broadcast.
 *
 * The OAuth backfill deliberately does NOT call this — a fresh Strava connect
 * pulling two weeks of activity would 100% cross the quota on stale data.
 */
export async function notifyQuotaHits(
  actorId: string,
  athletes: Athlete[],
  allActivities: Activity[],
  newActivityIds: string[],
  settings: Settings,
): Promise<void> {
  if (!ensureConfigured()) return;
  if (newActivityIds.length === 0) return;
  const goal = settings.weeklyGoal;
  if (goal <= 0) return;

  const range = periodRange("week", today());
  const fresh = new Set(newActivityIds);
  // Same guard as notifyOvertakes: only activities that landed inside this
  // week can push someone across this week's quota line.
  const movesThisWeek = allActivities.some(
    (a) => fresh.has(a.id) && a.occurredOn >= range[0] && a.occurredOn <= range[1],
  );
  if (!movesThisWeek) return;

  const before = standingsForRange(
    athletes,
    allActivities.filter((a) => !fresh.has(a.id)),
    settings,
    range,
  ).find((s) => s.athlete.id === actorId);
  const after = standingsForRange(athletes, allActivities, settings, range).find(
    (s) => s.athlete.id === actorId,
  );
  if (!after || !before) return;
  if (after.points < goal) return; // still below quota
  if (before.points >= goal) return; // was already through

  // Once per athlete per week. The scoring re-derivation makes this idempotent
  // even without the marker, but the marker protects against races and against
  // a manual sync + Strava cron landing the same batch twice in a row.
  const store = getStore();
  const marker = `quota-hit-${actorId}-${range[0]}`;
  if (await store.getMeta(marker)) return;
  await store.setMeta(marker, "1");

  const actor = athletes.find((a) => a.id === actorId);
  if (!actor) return;

  // Two flavours: the athlete gets a personal note, everyone else hears the news.
  await Promise.all([
    sendToAthlete(actorId, {
      title: "Quota crushed",
      body: `You're through the ${fmtPoints(goal)}-pt week. Everyone else knows about it.`,
      url: "/",
      tag: `quota-hit-${actorId}`,
    }),
    sendToAthletes(
      athletes.filter((a) => a.id !== actorId).map((a) => a.id),
      {
        title: `${actor.name} hit quota`,
        body: `${actor.name} is through the ${fmtPoints(goal)}-pt week. Time to catch up.`,
        url: "/",
        tag: `quota-hit-${actorId}`,
      },
    ),
  ]);
}
