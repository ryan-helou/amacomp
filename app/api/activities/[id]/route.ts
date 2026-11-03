import { NextResponse } from "next/server";
import { getStore, type ActivityPatch } from "@/lib/db";
import { currentAthlete, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";
import { isDayKey } from "@/lib/dates";
import { isSport, SPORT_UNIT } from "@/lib/types";
import { MAX_ELEVATION_M, MAX_KM, parseElevation, parseKm, parseNote } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** You own your own log. Ryan can also clean up anyone's, since he owns the rules. */
async function authorize(id: string) {
  const me = await currentAthlete();
  if (!me) return { error: "Sign in first.", status: 401 as const };
  const activity = await getStore().getActivity(id);
  if (!activity) return { error: "That session is already gone.", status: 404 as const };
  if (activity.athleteId !== me.id && !isAdmin(me)) {
    return { error: "You can only change your own sessions.", status: 403 as const };
  }
  return { me, activity };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: ActivityPatch = {};

  if (body.sport !== undefined) {
    if (!isSport(body.sport)) {
      return NextResponse.json({ error: "Pick a discipline." }, { status: 400 });
    }
    patch.sport = body.sport;
  }

  const effectiveSport = patch.sport ?? auth.activity.sport;
  if (SPORT_UNIT[effectiveSport] === "flat") {
    // Gym workouts are flat; the quantity is always 1 regardless of client input.
    patch.km = 1;
  } else if (body.km !== undefined) {
    const km = parseKm(body.km);
    if (km === null) {
      return NextResponse.json(
        { error: `Enter a distance between 0 and ${MAX_KM} km.` },
        { status: 400 },
      );
    }
    patch.km = km;
  }
  if (body.occurredOn !== undefined) {
    if (!isDayKey(body.occurredOn)) {
      return NextResponse.json({ error: "Pick a valid date." }, { status: 400 });
    }
    patch.occurredOn = body.occurredOn;
  }
  if (body.note !== undefined) {
    patch.note = parseNote(body.note);
  }
  if (body.elevationM !== undefined) {
    const elevationM = parseElevation(body.elevationM);
    if (elevationM === undefined) {
      return NextResponse.json(
        { error: `Enter an ascent between 0 and ${MAX_ELEVATION_M} m, or leave it blank.` },
        { status: 400 },
      );
    }
    patch.elevationM = elevationM;
  }
  if (body.openWater !== undefined) {
    // Tied to the sport the activity will END UP as, so switching a swim to a
    // run can't leave an open-water flag attached to a run.
    patch.openWater =
      effectiveSport === "swim" && typeof body.openWater === "boolean"
        ? body.openWater
        : null;
  }
  if (body.treadmill !== undefined) {
    patch.treadmill =
      effectiveSport === "run" && typeof body.treadmill === "boolean" ? body.treadmill : null;
  }

  await getStore().updateActivity(id, patch);
  return NextResponse.json(await readState());
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await authorize(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await getStore().deleteActivity(id);
  return NextResponse.json(await readState());
}
