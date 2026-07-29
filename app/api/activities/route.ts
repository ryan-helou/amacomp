import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentAthlete } from "@/lib/session";
import { readState } from "@/lib/state";
import { isDayKey } from "@/lib/dates";
import { isSport } from "@/lib/types";
import { MAX_KM, parseKm, parseNote } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentAthlete();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (!isSport(body.sport)) {
    return NextResponse.json({ error: "Pick swim, bike or run." }, { status: 400 });
  }
  const km = parseKm(body.km);
  if (km === null) {
    return NextResponse.json(
      { error: `Enter a distance between 0 and ${MAX_KM} km.` },
      { status: 400 },
    );
  }
  if (!isDayKey(body.occurredOn)) {
    return NextResponse.json({ error: "Pick a valid date." }, { status: 400 });
  }

  await getStore().createActivity({
    athleteId: me.id,
    sport: body.sport,
    km,
    occurredOn: body.occurredOn,
    note: parseNote(body.note),
  });

  return NextResponse.json(await readState());
}
