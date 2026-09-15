import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { leagueToday } from "@/lib/dates";
import { parseStepPayload } from "@/lib/steps";
import { hashStepToken, stepTokenFrom } from "@/lib/stepToken";

export const dynamic = "force-dynamic";

/**
 * Where each athlete's iOS Shortcut posts their Apple Health step totals.
 *
 * Authenticated by the athlete's step code, not the browser session — the
 * Shortcut has no cookies. Every day in the report REPLACES what was stored for
 * that day, so the Shortcut can resend the same days as often as it likes.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw; // parseStepPayload has another go at a string
  }

  const token = stepTokenFrom(req, body);
  if (!token) {
    return NextResponse.json(
      { error: "No step code. Connect this phone in AmaComp → Settings → Steps." },
      { status: 401 },
    );
  }
  const store = getStore();
  const athleteId = await store.athleteIdForStepToken(hashStepToken(token));
  if (!athleteId) {
    return NextResponse.json(
      { error: "That step code isn't recognised. Reconnect in AmaComp → Settings → Steps." },
      { status: 401 },
    );
  }

  const { days, rejected } = parseStepPayload(body, leagueToday());
  if (days.length === 0) {
    return NextResponse.json({ error: "No step totals in that report.", rejected }, { status: 400 });
  }
  const saved = await store.upsertStepDays(athleteId, days);
  return NextResponse.json({ ok: true, saved, rejected });
}
