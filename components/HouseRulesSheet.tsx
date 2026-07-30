"use client";

import { useEffect } from "react";
import { SPORT_ORDER, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, rateLabel, type Settings } from "@/lib/types";
import { Glyph } from "./Glyph";

/**
 * The league charter as a popup — the pact the lads play by. Opened from the
 * header (the AMACOMP wordmark or the "?"). Reads live from settings so the quota
 * and forfeit always match what's actually scored.
 */
export function HouseRulesSheet({
  settings,
  onClose,
}: {
  settings: Settings;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="House rules"
        className="relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t-2 border-ink bg-deck px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3" />

        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-gold" aria-hidden>
              <Glyph name="shield" className="h-7 w-7" />
            </span>
            <div>
              <p className="eyebrow text-ink-3">The pact</p>
              <h2 className="stamp text-2xl text-ink">House Rules</h2>
            </div>
          </div>
          <button onClick={onClose} className="eyebrow text-ink-2">
            Close
          </button>
        </div>

        {/* The weekly law */}
        <div className="flex items-center gap-4">
          <div className="stat shrink-0 leading-none text-ink" style={{ fontSize: "3.5rem" }}>
            {fmtPoints(settings.weeklyGoal)}
          </div>
          <div className="min-w-0">
            <p className="eyebrow accent-text">points · every week</p>
            <p className="mt-1 text-sm text-ink-2">
              Fall short and you owe:{" "}
              <span className="font-semibold text-ink">{settings.forfeit}</span>
            </p>
          </div>
        </div>

        <div className="my-5 h-px bg-line" />

        {/* End-of-season stakes */}
        <p className="eyebrow mb-2 text-ink-3">End of season</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-xl border-2 border-gold/40 bg-gold/5 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-gold" aria-hidden>
              <Glyph name="crown" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gold">First place eats free</p>
              <p className="text-[0.8125rem] text-ink-2">
                …and their name shines <span className="font-semibold text-gold">gold</span> all
                next season.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border-2 border-line bg-tile px-4 py-3">
            <span className="mt-0.5 shrink-0 text-run" aria-hidden>
              <Glyph name="flame" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Last place cooks the meal</p>
              <p className="text-[0.8125rem] text-ink-2">
                The whole crew chips in for it — everyone but the champ.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 border-t border-line pt-3 text-center font-mono text-[0.6875rem] text-ink-3">
          {SPORT_ORDER.map(
            (s) =>
              `${SPORT_UI[s].label.toLowerCase()} ${rateLabel(settings.multipliers[s], SPORT_UNIT[s])}`,
          ).join("  ·  ")}
        </p>
      </div>
    </div>
  );
}
