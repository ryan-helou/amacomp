import { NextResponse } from "next/server";
import { currentAthlete } from "@/lib/session";
import { pushEnabled, sendToAthlete } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST() {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!pushEnabled()) {
    return NextResponse.json({ error: "Push isn't configured yet." }, { status: 503 });
  }
  await sendToAthlete(me.id, {
    title: "Notifications are on",
    body: `You're all set, ${me.name}. This is what a nudge looks like.`,
    url: "/",
    tag: "test",
  });
  return NextResponse.json({ ok: true });
}
