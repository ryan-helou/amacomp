import { NextResponse } from "next/server";
import { normalizeName } from "@/lib/db";
import { signIn, signOut } from "@/lib/session";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readState());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? normalizeName(body.name) : "";

  if (!name) {
    return NextResponse.json({ error: "Enter your name to continue." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "Keep the name under 40 characters." }, { status: 400 });
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’.-]*$/u.test(name)) {
    return NextResponse.json(
      { error: "Names can use letters, numbers, spaces, apostrophes and hyphens." },
      { status: 400 },
    );
  }

  await signIn(name);
  return NextResponse.json(await readState());
}

export async function DELETE() {
  await signOut();
  return NextResponse.json(await readState());
}
