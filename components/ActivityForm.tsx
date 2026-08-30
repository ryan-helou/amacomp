"use client";

import { useState } from "react";
import { SPORT_ORDER, elevationPointsFor, fmtPoints, pointsFor, ratesOn } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { today, type DayKey } from "@/lib/dates";
import { BIG_SESSION_KM, MAX_ELEVATION_M, MAX_NOTE } from "@/lib/validate";
import {
  SPORT_UNIT, UNIT_LABEL, elevationRateLabel, rateLabel,
  type Settings, type Sport,
} from "@/lib/types";
import { SportMark } from "./SportMark";

export interface ActivityDraft {
  sport: Sport;
  km: string;
  occurredOn: DayKey;
  note: string;
  /** Metres of ascent as typed. Empty string = not stated, which scores nothing
   *  (see `parseElevation`) — it is not the same as a flat "0". */
  elevation: string;
}

export function emptyDraft(ref: DayKey = today()): ActivityDraft {
  return { sport: "run", km: "", occurredOn: ref, note: "", elevation: "" };
}

/** Trim float noise off a typed distance for the confirm copy. */
function fmtKmish(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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
  dateHint,
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
  /** Optional note under the date, explaining a default the athlete didn't pick —
   *  currently the pre-3 AM rollover, where "today" files as yesterday. */
  dateHint?: string | null;
}) {
  const unit = SPORT_UNIT[draft.sport];
  const isFlat = unit === "flat";
  // A flat discipline (gym) has no amount to enter — the quantity is one workout.
  const km = isFlat ? 1 : Number(draft.km);
  const valid = isFlat || (Number.isFinite(km) && km > 0);
  // Rates are read for the DAY BEING LOGGED, not today, so backdating a session
  // into an earlier rate era previews the points it will actually score.
  const rates = ratesOn(draft.occurredOn, settings);
  // Climb is only offered where it actually scores, so turning it on for another
  // discipline in the settings makes the field appear with no code change.
  const climbRate = rates.elevationPer100m?.[draft.sport] ?? 0;
  const climbs = !isFlat && climbRate > 0;
  const elevationM = draft.elevation.trim() === "" ? null : Number(draft.elevation);
  const climbPoints = climbs
    ? elevationPointsFor(elevationM, draft.sport, settings, draft.occurredOn)
    : 0;
  const points = valid
    ? pointsFor(km, draft.sport, settings, draft.occurredOn) + climbPoints
    : 0;

  // A distance well past what one session plausibly holds is far more often a
  // typo (100 typed as 1000) than a real ride. One extra tap to confirm — the
  // log still goes through exactly as entered if that's what they meant.
  const isBig = valid && km > BIG_SESSION_KM[draft.sport];
  // The confirm is pinned to the exact entry it was raised for, so editing the
  // distance retracts it on its own — a corrected number can never ride through
  // on a tap that was meant for the old one.
  const bigKey = `${draft.sport}|${km}`;
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const confirmingBig = isBig && confirmedKey === bigKey;

  function submit() {
    if (isBig && !confirmingBig) {
      setConfirmedKey(bigKey);
      return;
    }
    onSubmit();
  }

  // Switching disciplines normalizes the amount: gym carries a fixed "1", and
  // leaving gym clears that sentinel so the next distance is typed fresh.
  function selectSport(sport: Sport) {
    const nextFlat = SPORT_UNIT[sport] === "flat";
    const km = nextFlat ? "1" : isFlat ? "" : draft.km;
    // Drop any ascent the new discipline can't score, so switching bike -> run
    // never leaves an invisible number attached to the log.
    const keepClimb = !nextFlat && (rates.elevationPer100m?.[sport] ?? 0) > 0;
    setDraft({ ...draft, sport, km, elevation: keepClimb ? draft.elevation : "" });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
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
                onClick={() => selectSport(sport)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition-all ${ui.soft} ${ui.text} ${
                  on
                    ? `${ui.border} scale-[1.03] shadow-sm`
                    : "border-transparent opacity-75"
                }`}
              >
                <SportMark sport={sport} className="h-5 w-5" />
                <span className="eyebrow">{ui.label}</span>
                <span className="font-mono text-[0.625rem] leading-none">
                  {rateLabel(rates.multipliers[sport], SPORT_UNIT[sport])}
                </span>
                {(rates.elevationPer100m?.[sport] ?? 0) > 0 && (
                  <span className="font-mono text-[0.5625rem] leading-none opacity-70">
                    +{elevationRateLabel(rates.elevationPer100m[sport])}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <label htmlFor="km" className="eyebrow block text-ink-2">
            {isFlat ? "Session" : "Distance"}
          </label>
          {isFlat ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl pane border border-line-2 bg-tile px-4 py-3.5">
              <span className={SPORT_UI[draft.sport].text}>
                <SportMark sport={draft.sport} className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold text-ink">One workout</span>
            </div>
          ) : (
            <div className="mt-2 flex items-baseline gap-2 rounded-xl pane border border-line-2 bg-tile px-4 py-2.5">
              <input
                id="km"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={draft.km}
                onChange={(e) => setDraft({ ...draft, km: e.target.value })}
                placeholder="0"
                className="stamp w-full min-w-0 bg-transparent text-3xl text-ink placeholder:text-ink-3 focus:outline-none"
              />
              <span className="eyebrow shrink-0 text-ink-2">{UNIT_LABEL[unit]}</span>
            </div>
          )}
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

      {climbs && (
        <div>
          <label htmlFor="elevation" className="eyebrow block text-ink-2">
            Ascent <span className="text-ink-3">— optional</span>
          </label>
          <div className="mt-2 flex items-baseline gap-2 rounded-xl pane border border-line-2 bg-tile px-4 py-3 focus-within:border-accent">
            <input
              id="elevation"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              max={MAX_ELEVATION_M}
              value={draft.elevation}
              onChange={(e) => setDraft({ ...draft, elevation: e.target.value })}
              placeholder="0"
              className="w-full min-w-0 bg-transparent text-lg text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <span className="eyebrow shrink-0 text-ink-2">m</span>
          </div>
          <p className="mt-1 text-[0.75rem] text-ink-3">
            {elevationRateLabel(climbRate)} on top of the distance. Strava fills
            this in on its own — leave it blank if you don&apos;t know.
          </p>
        </div>
      )}

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
          // appearance-none stops iOS Safari from stripping the border off a
          // native date control; min-h keeps it the same height as the others.
          className="mt-2 block min-h-[52px] w-full appearance-none rounded-xl pane border border-line-2 bg-tile px-4 py-3 text-ink [color-scheme:light] focus:border-accent focus:outline-none"
        />
        {dateHint && (
          <p className="mt-1.5 text-[0.8125rem] text-ink-2">{dateHint}</p>
        )}
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
          className="mt-2 w-full rounded-xl pane border border-line-2 bg-tile px-4 py-3 text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-run">
          {error}
        </p>
      )}

      {confirmingBig && (
        <div
          role="status"
          className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-3"
        >
          <p className="eyebrow text-gold">That&apos;s a big one</p>
          <p className="mt-1 text-[0.8125rem] text-ink-2">
            {fmtKmish(km)} {UNIT_LABEL[unit]} of {SPORT_UI[draft.sport].label.toLowerCase()} in one
            session, worth {fmtPoints(points)} pts. Tap {submitLabel.toLowerCase()} again if
            that&apos;s right.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="eyebrow flex-1 rounded-xl pane border border-line bg-tile px-4 py-3.5 text-ink-2"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !valid}
          className={`eyebrow flex-1 rounded-xl px-4 py-3.5 shadow-sm transition-opacity disabled:opacity-40 ${
            confirmingBig ? "bg-gold text-white" : "accent-fill"
          }`}
        >
          {busy ? "Saving…" : confirmingBig ? `Yes — ${submitLabel}` : submitLabel}
        </button>
      </div>
    </form>
  );
}
