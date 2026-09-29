import { NextResponse } from "next/server";
import { grantAvatarPreview, revokeAvatarPreview } from "@/lib/preview";

export const dynamic = "force-dynamic";

/**
 * Where Ryan trades his key for the preview pass: /api/unlock?key=…
 *
 * A wrong key gets the same flat 404 as a made-up path, so the endpoint doesn't
 * tell a guesser that they've found something worth guessing at.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get("off") !== null) {
    await revokeAvatarPreview();
    return NextResponse.redirect(new URL("/", url), 303);
  }

  const ok = await grantAvatarPreview(url.searchParams.get("key"));
  if (!ok) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(new URL("/", url), 303);
}
