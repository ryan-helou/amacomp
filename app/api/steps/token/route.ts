import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete } from "@/lib/session";
import { hashStepToken, newStepToken } from "@/lib/stepToken";

export const dynamic = "force-dynamic";

/**
 * Issue the signed-in athlete a new step code, replacing any earlier one.
 * The plain code is returned exactly once, for the phone to hand to its
 * Shortcut; only its hash is kept.
 */
export async function POST() {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const token = newStepToken();
  await getStore().setStepToken(me.id, hashStepToken(token));
  return NextResponse.json({ token });
}
