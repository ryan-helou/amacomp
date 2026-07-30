"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/dates";
import type { League } from "./useLeague";

const STRAVA_ORANGE = "#FC5200";

/**
 * Link Strava so activities log themselves. The button is a real navigation (the
 * OAuth handshake needs a top-level redirect), not a fetch. "Sync now" and
 * "Disconnect" go through the league so the board updates in place.
 */
export function StravaSetup({ league }: { league: League }) {
  const { state, busy, send } = league;
  const s = state.strava;
  const [msg, setMsg] = useState<string | null>(null);

  // Hidden entirely when the server has no Strava credentials.
  if (!s.configured) return null;

  async function sync() {
    setMsg(null);
    const err = await send("/api/strava/sync", { method: "POST" });
    setMsg(err ?? "Up to date.");
  }

  async function disconnect() {
    setMsg(null);
    await send("/api/strava/disconnect", { method: "POST" });
  }

  const synced =
    s.lastSyncAtISO === null
      ? null
      : timeAgo(s.lastSyncAtISO) === "just now"
        ? "Synced just now."
        : `Last sync ${timeAgo(s.lastSyncAtISO)} ago.`;

  return (
    <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow text-ink">Strava</div>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">
            {s.connected
              ? `Rides, runs and swims log themselves. ${synced ?? ""}`.trim()
              : "Link Strava and your sessions log themselves — no double entry."}
          </p>
        </div>
        {!s.connected && (
          <a
            href="/api/strava/connect"
            style={{ backgroundColor: STRAVA_ORANGE }}
            className="eyebrow shrink-0 rounded-lg px-3 py-2 text-white shadow-sm"
          >
            Connect
          </a>
        )}
        {s.connected && (
          <span
            style={{ color: STRAVA_ORANGE }}
            className="eyebrow shrink-0 rounded-md bg-tile px-2 py-1"
          >
            Linked
          </span>
        )}
      </div>

      {s.connected && (
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <button
            onClick={sync}
            disabled={busy}
            className="eyebrow flex-1 rounded-lg border-2 border-line px-3 py-2 text-ink-2 disabled:opacity-40"
          >
            {busy ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={disconnect}
            disabled={busy}
            className="eyebrow rounded-lg px-3 py-2 text-ink-3 disabled:opacity-40"
          >
            Disconnect
          </button>
        </div>
      )}

      {msg && <p className="mt-2 text-xs font-medium text-ink-3">{msg}</p>}
    </div>
  );
}
