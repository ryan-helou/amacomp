"use client";

import { useEffect, useMemo } from "react";
import { activityPoints, fmtKm, fmtPoints, unscoredGymIds } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, isGrant, type AppState } from "@/lib/types";
import { addDays, formatDay, monthEnd, monthStart } from "@/lib/dates";
import type { HallRecord } from "@/lib/records";
import { SportMark } from "./SportMark";
import { Avatar } from "./Avatar";
import { AthleteName } from "./ProfileContext";

/**
 * The story behind a Hall of Fame record — what sessions built it, in the
 * order they happened. Filters the full activity list back down using the
 * record's `context` so a claimed record can always be replayed.
 */
export function RecordSheet({
  record,
  state,
  onClose,
}: {
  record: HallRecord;
  state: AppState;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const holder = record.holderId
    ? state.athletes.find((a) => a.id === record.holderId) ?? null
    : null;
  const unscored = useMemo(() => unscoredGymIds(state.activities), [state.activities]);

  // The sessions that built this record, oldest first so it reads as a story.
  const contributing = useMemo(() => {
    if (!record.context || !record.holderId) return [];
    // Records are built from logged sessions only — awarded points never count.
    const mine = state.activities.filter(
      (a) => a.athleteId === record.holderId && !isGrant(a),
    );
    const ctx = record.context;
    if (ctx.kind === "activity") {
      return mine.filter((a) => a.id === ctx.activityId);
    }
    if (ctx.kind === "day") {
      return mine
        .filter((a) => a.occurredOn === ctx.day)
        .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    }
    if (ctx.kind === "week") {
      const from = ctx.weekStart;
      const to = addDays(from, 6);
      return mine
        .filter((a) => a.occurredOn >= from && a.occurredOn <= to)
        .sort(
          (x, y) =>
            x.occurredOn.localeCompare(y.occurredOn) ||
            x.createdAt.localeCompare(y.createdAt),
        );
    }
    if (ctx.kind === "month") {
      const from = monthStart(ctx.month);
      const to = monthEnd(ctx.month);
      return mine
        .filter((a) => a.occurredOn >= from && a.occurredOn <= to)
        .sort(
          (x, y) =>
            x.occurredOn.localeCompare(y.occurredOn) ||
            x.createdAt.localeCompare(y.createdAt),
        );
    }
    if (ctx.kind === "range") {
      return mine
        .filter((a) => a.occurredOn >= ctx.from && a.occurredOn <= ctx.to)
        .sort(
          (x, y) =>
            x.occurredOn.localeCompare(y.occurredOn) ||
            x.createdAt.localeCompare(y.createdAt),
        );
    }
    // streak — sessions on each day of the run
    const start = addDays(ctx.endDay, -(ctx.length - 1));
    return mine
      .filter((a) => a.occurredOn >= start && a.occurredOn <= ctx.endDay)
      .sort(
        (x, y) =>
          x.occurredOn.localeCompare(y.occurredOn) ||
          x.createdAt.localeCompare(y.createdAt),
      );
  }, [record, state.activities]);

  const shown = record.unit === "km" ? fmtKm(record.value) : fmtPoints(record.value);
  const totalPts = contributing.reduce(
    (sum, a) => sum + activityPoints(a, state.settings, unscored),
    0,
  );
  // Days spanned — useful for streaks + weeks.
  const uniqueDays = new Set(contributing.map((a) => a.occurredOn)).size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={record.label}
        className="relative flex max-h-[88dvh] flex-col glass-raised rounded-t-3xl border-t border-line-2"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3" />
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-gold">{record.label}</p>
              <p className="mt-0.5 font-mono text-xs text-ink-3">{record.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="stamp text-2xl text-gold">{shown}</div>
              <div className="eyebrow text-ink-3">{record.unit}</div>
            </div>
          </div>

          {holder && (
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <Avatar athlete={holder} className="h-7 w-7 text-[0.5625rem]" />
              <span className="text-sm text-ink-2">Set by</span>
              <AthleteName
                id={holder.id}
                name={holder.name}
                className="text-sm font-semibold text-ink"
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {contributing.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
              The sessions behind this record are no longer in the log.
            </p>
          ) : (
            <>
              <div className="eyebrow mb-2 text-ink-3">
                {contributing.length === 1
                  ? "The session"
                  : `${contributing.length} sessions${
                      uniqueDays > 1 ? ` across ${uniqueDays} days` : ""
                    }`}
              </div>
              <ul className="space-y-1.5">
                {contributing.map((a) => {
                  const ui = SPORT_UI[a.sport];
                  const isFlat = SPORT_UNIT[a.sport] === "flat";
                  const capped = unscored.has(a.id);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl bg-tile px-3 py-2.5"
                    >
                      <span className={ui.text}>
                        <SportMark sport={a.sport} className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          <span className="font-mono text-xs text-ink-3">
                            {formatDay(a.occurredOn)}
                          </span>
                          <span className="text-ink-2">
                            {" — "}
                            {isFlat
                              ? `${ui.label.toLowerCase()} workout`
                              : `${fmtKm(a.km)} ${SPORT_UNIT[a.sport]} ${ui.label.toLowerCase()}`}
                          </span>
                          {a.source === "strava" && (
                            <span className="text-ink-3"> · via Strava</span>
                          )}
                        </p>
                        {a.note && (
                          <p className="truncate text-[0.8125rem] text-ink-3">{a.note}</p>
                        )}
                      </div>
                      <span
                        className={`stamp shrink-0 text-base ${
                          capped ? "text-ink-3 line-through" : ui.text
                        }`}
                      >
                        {fmtPoints(activityPoints(a, state.settings, unscored))}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Only worth showing for records that are a sum: pts and sessions.
                  For a single-activity or km record, "total" is the record itself. */}
              {(record.unit === "pts" || record.unit === "sessions") &&
                contributing.length > 1 && (
                  <div className="mt-3 flex items-baseline justify-between border-t border-line-2 pt-2 font-mono text-xs">
                    <span className="text-ink-2">Total</span>
                    <span className="text-ink">
                      {record.unit === "pts"
                        ? `${fmtPoints(totalPts)} pts`
                        : `${contributing.length} sessions`}
                    </span>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

