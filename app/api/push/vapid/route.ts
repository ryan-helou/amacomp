import { NextResponse } from "next/server";
import { pushEnabled, vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    enabled: pushEnabled(),
    publicKey: vapidPublicKey(),
  });
}
