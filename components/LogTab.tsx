"use client";

import { useMemo, useState } from "react";
import {
  activityPoints, elevationPointsFor, fmtKm, fmtPoints, pointsFor, unscoredGymIds,
} from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { RESET_HOUR, formatDay, formatDayRelative, weekStart, type DayKey } from "@/lib/dates";
import { SPORT_UNIT, UNIT_LABEL, isGrant, type Activity } from "@/lib/types";
import { MAX_SCORING_GYM_PER_DAY } from "@/lib/validate";
import { SportMark } from "./SportMark";
import { ActivityForm, emptyDraft, type ActivityDraft } from "./ActivityForm";
import type { League } from "./useLeague";

export function LogTab({
  league,
  refDay,
  logDay,
}: {
  league: League;
  /** The real calendar day — the latest date a session may be filed under. */
  refDay: DayKey;
  /** The day a session logged right now counts for. Before the 3 AM rollover
   *  that is still yesterday, which is what a new log defaults to. */
  logDay: DayKey;
}) {
  const { state, busy, send } = league;
  const [draft, setDraft] = useState<ActivityDraft>(() => emptyDraft(logDay));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ActivityDraft>(() => emptyDraft(logDay));
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Your logged sessions — admin grants are awarded, not logged, so they're not
  // yours to edit here; they show up on the Week tab instead.
  const mine = useMemo(
    () => state.activities.filter((a) => a.athleteId === state.me?.id && !isGrant(a)),
    [state.activities, state.me?.id],
  );
  const unscored = useMemo(() => unscoredGymIds(state.activities), [state.activities]);

  async function create() {
    setError(null);
    const err = await send("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        sport: draft.sport,
        km: Number(draft.km),
        occurredOn: draft.occurredOn,
        note: draft.note,
        elevationM: draft.elevation.trim() === "" ? null : Number(draft.elevation),
      }),
    });
    if (err) {
      setError(err);
      return;
    }
    const points = fmtPoints(
      pointsFor(Number(draft.km), draft.sport, state.settings, draft.occurredOn) +
        elevationPointsFor(
          draft.elevation.trim() === "" ? null : Number(draft.elevation),
          draft.sport,
          state.settings,
          draft.occurredOn,
        ),
    );
    setSaved(`${points} pts added.`);
    setDraft({ ...emptyDraft(logDay), sport: draft.sport });
    setTimeout(() => setSaved(null), 2600);
  }

  function startEdit(a: Activity) {
    setEditing(a.id);
    setEditError(null);
    setConfirmDelete(null);
    setEditDraft({
      sport: a.sport,
      km: String(a.km),
      occurredOn: a.occurredOn,
      note: a.note ?? "",
      elevation: a.elevationM === null ? "" : String(a.elevationM),
    });
  }

  async function saveEdit(id: string) {
    setEditError(null);
    const err = await send(`/api/activities/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        sport: editDraft.sport,
        km: Number(editDraft.km),
        occurredOn: editDraft.occurredOn,
        note: editDraft.note,
        elevationM:
          editDraft.elevation.trim() === "" ? null : Number(editDraft.elevation),
      }),
    });
    if (err) {
      setEditError(err);
      return;
    }
    setEditing(null);
  }

  async function remove(id: string) {
    const err = await send(`/api/activities/${id}`, { method: "DELETE" });
    if (err) setError(err);
    setConfirmDelete(null);
  }

  // Between midnight and the rollover the board has already turned over but a
  // session still counts for the day that ended, so the form's date looks
  // "wrong" unless we say why. Only shown while the draft is on that default —
  // once they move the date themselves the explanation no longer applies.
  const inGraceWindow = logDay !== refDay;
  const dateHint =
    inGraceWindow && draft.occurredOn === logDay
      ? `Before ${RESET_HOUR} AM, so this counts for ${formatDay(logDay)}${
          weekStart(logDay) !== weekStart(refDay) ? " — last week" : ""
        }. Change the date to put it on today instead.`
      : null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="eyebrow text-ink-2">Log a session</h2>
        <div className="mt-3 rounded-2xl border border-line bg-deck-2/40 p-4">
          <ActivityForm
            settings={state.settings}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            error={error}
            submitLabel="Add to the board"
            onSubmit={create}
            maxDate={refDay}
            dateHint={dateHint}
          />
        </div>
        {saved && (
          <p
            role="status"
            className="eyebrow mt-3 rounded-xl bg-good/12 px-4 py-3 text-good"
          >
            {saved}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow text-ink-2">Your sessions</h2>
          <span className="font-mono text-xs text-ink-3">{mine.length} logged</span>
        </div>

        {mine.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            Nothing logged yet. Your first session goes on the board above.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((a) => {
              const ui = SPORT_UI[a.sport];
              const isEditing = editing === a.id;

              if (isEditing) {
                return (
                  <li
                    key={a.id}
                    className="rounded-2xl pane border border-line-2 bg-tile p-4"
                  >
                    <p className="eyebrow mb-3 text-ink-2">Edit session</p>
                    <ActivityForm
                      settings={state.settings}
                      draft={editDraft}
                      setDraft={setEditDraft}
                      busy={busy}
                      error={editError}
                      submitLabel="Save changes"
                      onSubmit={() => saveEdit(a.id)}
                      onCancel={() => setEditing(null)}
                      maxDate={refDay}
                    />
                  </li>
                );
              }

              return (
                <li
                  key={a.id}
                  className="rounded-2xl pane border border-line bg-tile px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className={ui.text}>
                      <SportMark sport={a.sport} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="stamp text-lg text-ink">
                          {fmtKm(a.km)}
                        </span>
                        <span className="eyebrow text-ink-3">{UNIT_LABEL[SPORT_UNIT[a.sport]]}</span>
                        <span className="text-xs text-ink-3">·</span>
                        <span className="font-mono text-xs text-ink-2">
                          {formatDayRelative(a.occurredOn, refDay)}
                        </span>
                      </div>
                      {a.note && (
                        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-2">
                          {a.note}
                        </p>
                      )}
                      {unscored.has(a.id) && (
                        <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                          Past the {MAX_SCORING_GYM_PER_DAY}-a-day gym cap — logged, not scored.
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div
                        className={`stamp text-xl ${
                          unscored.has(a.id) ? "text-ink-3 line-through" : ui.text
                        }`}
                      >
                        {fmtPoints(activityPoints(a, state.settings, unscored))}
                      </div>
                      <div className="eyebrow text-ink-3">pts</div>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end gap-2 border-t border-line pt-2">
                    {confirmDelete === a.id ? (
                      <>
                        <span className="mr-auto self-center text-[0.8125rem] text-ink-2">
                          Delete this session?
                        </span>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="eyebrow rounded-lg px-3 py-1.5 text-ink-2"
                        >
                          Keep
                        </button>
                        <button
                          onClick={() => remove(a.id)}
                          disabled={busy}
                          className="eyebrow rounded-lg bg-run px-3 py-1.5 text-white disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(a)}
                          className="eyebrow rounded-lg px-3 py-1.5 text-ink-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDelete(a.id)}
                          className="eyebrow rounded-lg px-3 py-1.5 text-ink-2"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
