"use client";

import { useEffect, useState } from "react";
import { SPORT_ORDER } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, UNIT_ABBR, type Settings } from "@/lib/types";
import { SportMark } from "./SportMark";
import type { League } from "./useLeague";

/**
 * The rules panel. Everyone can read the scoring; only the admin gets inputs —
 * enforced on the server too, this is just the matching interface.
 */
export function ScoringSheet({
  league,
  onClose,
}: {
  league: League;
  onClose: () => void;
}) {
  const { state, busy, send } = league;
  const editable = state.isAdmin;

  const [form, setForm] = useState(() => ({
    swim: String(state.settings.multipliers.swim),
    bike: String(state.settings.multipliers.bike),
    run: String(state.settings.multipliers.run),
    gym: String(state.settings.multipliers.gym),
    weeklyGoal: String(state.settings.weeklyGoal),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setError(null);
    setSaved(false);
    const payload: Settings = {
      multipliers: {
        swim: Number(form.swim),
        bike: Number(form.bike),
        run: Number(form.run),
        gym: Number(form.gym),
      },
      weeklyGoal: Number(form.weeklyGoal),
    };
    const err = await send("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (err) {
      setError(err);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2600);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close scoring"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scoring"
        className="relative max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t-2 border-ink bg-deck px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3" />

        <div className="flex items-baseline justify-between">
          <h2 className="stamp text-2xl text-ink">SCORING</h2>
          <button onClick={onClose} className="eyebrow text-ink-2">
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-ink-2">
          {editable
            ? "Change the points per kilometre or the weekly quota. Every session already logged re-scores under the new rules."
            : "These are the league rules. Ryan sets them."}
        </p>

        <div className="mt-5 space-y-3">
          {SPORT_ORDER.map((sport) => {
            const ui = SPORT_UI[sport];
            return (
              <div
                key={sport}
                className="flex items-center gap-3 rounded-xl border-2 border-line bg-tile px-4 py-3"
              >
                <span className={ui.text}>
                  <SportMark sport={sport} className="h-5 w-5" />
                </span>
                <label htmlFor={`m-${sport}`} className="eyebrow flex-1 text-ink">
                  {ui.label}
                </label>
                <input
                  id={`m-${sport}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  readOnly={!editable}
                  value={form[sport]}
                  onChange={(e) => setForm({ ...form, [sport]: e.target.value })}
                  className={`stamp w-20 rounded-lg border-2 px-2 py-1.5 text-right text-xl text-ink focus:outline-none ${
                    editable ? "border-ink bg-tile" : "border-transparent bg-transparent"
                  }`}
                />
                <span className="eyebrow w-12 text-ink-3">pts/{UNIT_ABBR[SPORT_UNIT[sport]]}</span>
              </div>
            );
          })}

          <div className="flex items-center gap-3 rounded-xl border-2 border-ink bg-deck-2/50 px-4 py-3">
            <label htmlFor="goal" className="eyebrow flex-1 text-ink">
              Weekly quota
            </label>
            <input
              id="goal"
              type="number"
              inputMode="decimal"
              step="1"
              min="1"
              readOnly={!editable}
              value={form.weeklyGoal}
              onChange={(e) => setForm({ ...form, weeklyGoal: e.target.value })}
              className={`stamp w-20 rounded-lg border-2 px-2 py-1.5 text-right text-xl text-ink focus:outline-none ${
                editable ? "border-ink bg-tile" : "border-transparent bg-transparent"
              }`}
            />
            <span className="eyebrow w-12 text-ink-3">pts</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-run">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="eyebrow mt-3 text-good">
            Rules updated — the board has re-scored.
          </p>
        )}

        {editable && (
          <button
            onClick={save}
            disabled={busy}
            className="eyebrow mt-5 w-full rounded-xl bg-ink px-4 py-4 text-tile disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save scoring"}
          </button>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <p className="text-xs text-ink-3">
            Signed in as{" "}
            <span className="font-semibold text-ink-2">{state.me?.name}</span>
            {state.isAdmin && " · league admin"}
          </p>
          <button
            onClick={async () => {
              await send("/api/session", { method: "DELETE" });
              onClose();
            }}
            className="eyebrow mt-3 w-full rounded-xl border-2 border-line bg-tile px-4 py-3 text-ink-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
