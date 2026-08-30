"use client";

import { useEffect, useRef, useState } from "react";
import { SPORT_ORDER, fmtPoints, ratesOn } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { RESET_HOUR, type DayKey } from "@/lib/dates";
import { SPORT_UNIT, elevationRateLabel, rateLabel, type Settings } from "@/lib/types";
import { Glyph } from "./Glyph";

/**
 * The league charter as a popup — the pact the lads play by. Opened from the
 * header (the AMACOMP wordmark or the "?"). Reads live from settings so the quota
 * and forfeit always match what's actually scored. Closes on backdrop tap, the
 * Close button, Escape, or a swipe down.
 */
export function HouseRulesSheet({
  settings,
  refDay,
  onClose,
}: {
  settings: Settings;
  /** Today — the charter quotes the rates in force now. */
  refDay: DayKey;
  onClose: () => void;
}) {
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Swipe-to-dismiss from the grab handle. Touch events stay bound to the handle
  // for the whole gesture, so this never fights the content scroll. Past ~100px
  // of pull, let go to close; otherwise it springs back.
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    if (startY.current == null) return;
    if (dragY > 100) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="House rules"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 0.25s ease",
        }}
        className="relative max-h-[88dvh] overflow-y-auto glass-raised rounded-t-3xl border-t border-line-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
      >
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="-mx-5 -mt-5 mb-4 cursor-grab touch-none px-5 pb-2 pt-3 active:cursor-grabbing"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-ink-3" />
        </div>

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

        <p className="mt-4 rounded-xl pane border border-line bg-tile px-4 py-3 text-[0.8125rem] text-ink-2">
          Weeks run Monday to Sunday, and the day rolls over at{" "}
          <span className="font-semibold text-ink">{RESET_HOUR} AM</span> — the same hour
          for everyone. A Sunday night session that finishes at 1 AM still counts for
          that week.
        </p>

        <div className="my-5 h-px bg-line" />

        {/* End-of-season stakes */}
        <p className="eyebrow mb-2 text-ink-3">End of season</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
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
          <div className="flex items-start gap-3 rounded-xl pane border border-line bg-tile px-4 py-3">
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
          {SPORT_ORDER.map((s) => {
            const rates = ratesOn(refDay, settings);
            const climb = elevationRateLabel(rates.elevationPer100m?.[s] ?? 0);
            return `${SPORT_UI[s].label.toLowerCase()} ${rateLabel(rates.multipliers[s], SPORT_UNIT[s])}${climb ? ` +${climb}` : ""}`;
          }).join("  ·  ")}
        </p>
      </div>
    </div>
  );
}
