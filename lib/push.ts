import "server-only";
import webpush from "web-push";
import { getStore, type PushSub } from "./db";
import { standingsForRange } from "./scoring";
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
 * When `actor` logs a session this week, notify anyone they leapfrogged on the
 * weekly board — the drama that pulls people back in. Compares the standings
 * with and without the new activity.
 */
export async function notifyOvertakes(
  actorId: string,
  athletes: Athlete[],
  allActivities: Activity[],
  newActivityId: string,
  settings: Settings,
): Promise<void> {
  if (!ensureConfigured()) return;
  const range = periodRange("week", today());
  const fresh = allActivities.find((a) => a.id === newActivityId);
  if (!fresh || fresh.occurredOn < range[0] || fresh.occurredOn > range[1]) return;

  const before = allActivities.filter((a) => a.id !== newActivityId);
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
    passed.map((x) =>
      sendToAthlete(x.id, {
        title: "You just got passed",
        body: `${actor.name} overtook you — you're #${aRank.get(x.id)} this week now.`,
        url: "/",
        tag: "overtake",
      }),
    ),
  );
}
