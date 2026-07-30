import { fmtPoints } from "@/lib/scoring";
import type { TrendWeek } from "@/lib/stats";

/** Eight-week points trend as a compact bar chart, with the quota line. */
export function TrendChart({
  weeks,
  goal,
}: {
  weeks: TrendWeek[];
  goal: number;
}) {
  const max = Math.max(goal, ...weeks.map((w) => w.points), 1) * 1.12;
  const goalPct = (goal / max) * 100;

  return (
    <div>
      <div className="relative flex h-28 items-end gap-1.5">
        {/* Quota line */}
        {goal > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3"
            style={{ bottom: `${goalPct}%` }}
          >
            <span className="absolute -top-2 right-0 bg-deck px-1 font-mono text-[0.5625rem] text-ink-3">
              {fmtPoints(goal)}
            </span>
          </div>
        )}
        {weeks.map((w) => (
          <div key={w.weekKey} className="flex h-full flex-1 flex-col justify-end">
            <div
              title={`${w.label}: ${fmtPoints(w.points)} pts`}
              className={`w-full rounded-t ${w.hit ? "accent-fill" : "bg-ink-3/40"}`}
              style={{ height: `${Math.max((w.points / max) * 100, w.points > 0 ? 3 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {weeks.map((w) => (
          <div
            key={w.weekKey}
            className="flex-1 text-center font-mono text-[0.5625rem] text-ink-3"
          >
            {w.label}
          </div>
        ))}
      </div>
    </div>
  );
}
