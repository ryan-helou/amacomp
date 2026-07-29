"use client";

import { SPORT_ORDER, fmtPoints, pointsFor } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { today, type DayKey } from "@/lib/dates";
import { MAX_NOTE } from "@/lib/validate";
import { SPORT_UNIT, UNIT_LABEL, UNIT_NOUN, type Settings, type Sport } from "@/lib/types";
import { SportMark } from "./SportMark";

export interface ActivityDraft {
  sport: Sport;
  km: string;
  occurredOn: DayKey;
  note: string;
}

export function emptyDraft(ref: DayKey = today()): ActivityDraft {
  return { sport: "run", km: "", occurredOn: ref, note: "" };
}

export function ActivityForm({
  settings,
  draft,
  setDraft,
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  maxDate,
}: {
  settings: Settings;
  draft: ActivityDraft;
  setDraft: (d: ActivityDraft) => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  maxDate: DayKey;
}) {
  const km = Number(draft.km);
  const valid = Number.isFinite(km) && km > 0;
  const points = valid ? pointsFor(km, draft.sport, settings) : 0;
  const unit = SPORT_UNIT[draft.sport];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      <fieldset>
        <legend className="eyebrow text-ink-2">Discipline</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {SPORT_ORDER.map((sport) => {
            const ui = SPORT_UI[sport];
            const on = draft.sport === sport;
            return (
              <button
                key={sport}
                type="button"
                aria-pressed={on}
                onClick={() => setDraft({ ...draft, sport })}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-colors ${
                  on
                    ? `${ui.border} ${ui.soft} ${ui.text}`
                    : "border-line bg-tile text-ink-3"
                }`}
              >
                <SportMark sport={sport} className="h-5 w-5" />
                <span className="eyebrow">{ui.label}</span>
                <span className="font-mono text-[0.625rem] leading-none">
                  {settings.multipliers[sport]}/{SPORT_UNIT[sport]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <label htmlFor="km" className="eyebrow block text-ink-2">
            {UNIT_NOUN[unit]}
          </label>
          <div className="mt-2 flex items-baseline gap-2 rounded-xl border-2 border-ink bg-tile px-4 py-2.5">
            <input
              id="km"
              type="number"
              inputMode="decimal"
              step={unit === "hr" ? "0.25" : "0.01"}
              min="0"
              value={draft.km}
              onChange={(e) => setDraft({ ...draft, km: e.target.value })}
              placeholder="0"
              className="stamp w-full min-w-0 bg-transparent text-3xl text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <span className="eyebrow shrink-0 text-ink-2">{UNIT_LABEL[unit]}</span>
          </div>
        </div>

        <div className="pb-1 text-right">
          <div className="eyebrow text-ink-2">Worth</div>
          <div
            className={`stamp mt-1 text-3xl tabular-nums ${
              valid ? SPORT_UI[draft.sport].text : "text-ink-3"
            }`}
          >
            {fmtPoints(points)}
          </div>
          <div className="eyebrow text-ink-3">pts</div>
        </div>
      </div>

      <div>
        <label htmlFor="date" className="eyebrow block text-ink-2">
          Date
        </label>
        <input
          id="date"
          type="date"
          value={draft.occurredOn}
          max={maxDate}
          onChange={(e) =>
            setDraft({ ...draft, occurredOn: e.target.value as DayKey })
          }
          className="mt-2 w-full rounded-xl border-2 border-line bg-tile px-4 py-3 text-ink focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="note" className="eyebrow block text-ink-2">
          Note <span className="text-ink-3">— optional</span>
        </label>
        <input
          id="note"
          value={draft.note}
          maxLength={MAX_NOTE}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder="Brick session, hills, leg day…"
          className="mt-2 w-full rounded-xl border-2 border-line bg-tile px-4 py-3 text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-run">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="eyebrow flex-1 rounded-xl border-2 border-line bg-tile px-4 py-3.5 text-ink-2"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !valid}
          className="eyebrow flex-1 rounded-xl bg-ink px-4 py-3.5 text-tile transition-opacity disabled:opacity-40"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
