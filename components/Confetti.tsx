"use client";

import { useEffect, useRef } from "react";

const COLORS = [
  "#3d5aff", "#8b3df5", "#0d93bd", "#d98217", "#d93b30", "#6d4fc4", "#b08307",
];
// At Christmas the burst is cranberry, pine, gold and snow.
const XMAS_COLORS = ["#d42a35", "#e23a44", "#1f7a45", "#2fbf6a", "#f2c94c", "#ffffff"];

/** A one-shot confetti burst. Increment `fireKey` to set it off. */
export function Confetti({ fireKey }: { fireKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (fireKey === 0) return;
    const palette = document.documentElement.getAttribute("data-festive") ? XMAS_COLORS : COLORS;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * W,
      y: -Math.random() * H * 0.4,
      w: (5 + Math.random() * 6) * dpr,
      h: (8 + Math.random() * 8) * dpr,
      vx: (-1 + Math.random() * 2) * dpr,
      vy: (2 + Math.random() * 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));

    const DURATION = 2600;
    const start = performance.now();
    let raf = 0;

    const frame = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03 * dpr;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < DURATION) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [fireKey]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden
    />
  );
}
