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

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-md justify-center"
      style={{
        transform: `translateY(${y}px)`,
        opacity: visible ? 1 : 0,
        transition: dragging ? "none" : "transform 220ms ease, opacity 220ms ease",
      }}
    >
      <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-deck shadow-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-[18px] w-[18px] text-ink ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        >
          <path d="M20 12a8 8 0 1 1-2.3-5.6" />
          <path d="M20 4v4.5h-4.5" />
        </svg>
      </div>
    </div>
  );
}
