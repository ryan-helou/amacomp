import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The build the server is running. Polled by UpdateWatcher, which reloads the
 * page when this differs from the build the page itself was loaded from.
 * Never cached — a cached answer is the one thing that would defeat it.
 */
export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
