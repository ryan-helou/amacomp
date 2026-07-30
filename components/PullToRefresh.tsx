"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pull-to-refresh for the home-screen app. A standalone PWA has no browser
 * chrome, so the OS gesture never fires — we drive it ourselves: when the page
 * is scrolled to the very top and the user drags down past a threshold, we
 * refetch the whole app state. A spinner descends from the top edge and spins
 * while the refresh runs. Disabled while a bottom sheet is open so it never
 * fights a modal's own scroll.
 */

const TRIGGER = 70; // px of pull (after damping) that commits a refresh
const MAX = 100; // cap on how far the indicator travels
const RESIST = 0.5; // drag damping, so it feels like it's under tension

export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Refs mirror state so the (once-attached) listeners never read stale values.
  const startY = useRef(0);
  const engaged = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const apply = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    function start(e: TouchEvent) {
      if (refreshingRef.current || e.touches.length !== 1) return;
      // Only from the very top, and never over an open sheet/modal.
      if (window.scrollY > 0 || document.querySelector('[role="dialog"]')) {
        engaged.current = false;
        return;
      }
      engaged.current = true;
      startY.current = e.touches[0].clientY;
    }

    function move(e: TouchEvent) {
      if (!engaged.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current) apply(0);
        setDragging(false);
        return;
      }
      // If the page started scrolling under us, hand the gesture back.
      if (window.scrollY > 0) {
        engaged.current = false;
        apply(0);
        setDragging(false);
        return;
      }
      setDragging(true);
      apply(Math.min(MAX, dy * RESIST));
      // Suppress the browser's own overscroll/refresh while we drive it.
      if (e.cancelable) e.preventDefault();
    }

    async function end() {
      if (!engaged.current) return;
      engaged.current = false;
      setDragging(false);
      const committed = pullRef.current >= TRIGGER;
      if (committed) {
        setRefreshing(true);
        apply(TRIGGER);
        try {
          await onRefreshRef.current();
        } catch {
          /* a failed refresh shouldn't leave the spinner stuck */
        }
        setRefreshing(false);
      }
      apply(0);
    }

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, []);

  const progress = Math.min(1, pull / TRIGGER);
  const y = refreshing ? TRIGGER : pull;
  const visible = pull > 0 || refreshing;

  // Ring geometry. The arc fills as you pull; once refreshing it becomes a
  // fixed sweep and the whole SVG spins — echoing the pace-clock quota ring.
  const R = 16;
  const C = 2 * Math.PI * R;
  const sweep = refreshing ? 0.28 : progress;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-md justify-center"
      style={{
        transform: `translateY(${y}px) scale(${refreshing ? 1 : 0.55 + 0.45 * progress})`,
        opacity: visible ? (refreshing ? 1 : Math.max(0.3, progress)) : 0,
        transition: dragging
          ? "none"
          : "transform 240ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease",
      }}
    >
      <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-tile shadow-[0_8px_22px_-6px_rgba(13,34,49,0.4)] ring-1 ring-ink/5">
        <svg
          viewBox="0 0 40 40"
          className={`h-8 w-8 ${refreshing ? "animate-spin" : ""}`}
          style={{ transformOrigin: "center" }}
        >
          <defs>
            <linearGradient id="ptr-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="100%" stopColor="var(--color-accent-2)" />
            </linearGradient>
          </defs>
          {/* faint track */}
          <circle cx="20" cy="20" r={R} fill="none" stroke="var(--color-line)" strokeWidth="4" opacity="0.5" />
          {/* gradient arc — fills with the pull, sweeps while refreshing */}
          <circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke="url(#ptr-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - sweep)}
            transform="rotate(-90 20 20)"
          />
        </svg>
      </div>
    </div>
  );
}
