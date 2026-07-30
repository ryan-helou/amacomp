"use client";

import { useEffect, useMemo, useState } from "react";
import { activityPoints, fmtKm, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import {
  MAX_COMMENT,
  REACTIONS,
  REACTION_LABEL,
  SPORT_UNIT,
  type Activity,
} from "@/lib/types";
import { formatDayRelative, timeAgo, type DayKey } from "@/lib/dates";
import {
  REACTION_GLYPH,
  commentsFor,
  myReaction,
  reactionCounts,
} from "@/lib/banter";
import { Avatar } from "./Avatar";
import { Glyph } from "./Glyph";
import { SportMark } from "./SportMark";
import type { League } from "./useLeague";

export function ActivitySheet({
  league,
  activity,
  refDay,
  onClose,
}: {
  league: League;
  activity: Activity;
  refDay: DayKey;
  onClose: () => void;
}) {
  const { state, busy, send } = league;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  // You can bin your own session; the admin can bin anyone's.
  const canManage = activity.athleteId === state.me?.id || state.isAdmin;

  const nameOf = useMemo(
    () => new Map(state.athletes.map((a) => [a.id, a.name])),
    [state.athletes],
  );
  const athleteOf = useMemo(
    () => new Map(state.athletes.map((a) => [a.id, a])),
    [state.athletes],
  );

  const { counts, total } = reactionCounts(activity.id, state.reactions);
  const mine = myReaction(activity.id, state.me?.id, state.reactions);
  const comments = commentsFor(activity.id, state.comments);
  const ui = SPORT_UI[activity.sport];
  const isFlat = SPORT_UNIT[activity.sport] === "flat";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function react(type: (typeof REACTIONS)[number]) {
    if (mine === type) {
      await send(`/api/activities/${activity.id}/react`, { method: "DELETE" });
    } else {
      await send(`/api/activities/${activity.id}/react`, {
        method: "POST",
        body: JSON.stringify({ type }),
      });
    }
  }

  async function addComment() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    const err = await send(`/api/activities/${activity.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    if (err) setError(err);
    else setText("");
  }

  async function remove() {
    setDelErr(null);
    const err = await send(`/api/activities/${activity.id}`, { method: "DELETE" });
    if (err) setDelErr(err);
    else onClose(); // the session's gone; drop the sheet
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session"
        className="relative flex max-h-[88dvh] flex-col rounded-t-3xl border-t-2 border-ink bg-deck"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-3" />
          {/* Session header */}
          <div className="flex items-center gap-3 pb-3">
            <span className={ui.text}>
              <SportMark sport={activity.sport} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-ink">
                  {nameOf.get(activity.athleteId) ?? "Unknown"}
                </span>
                <span className="font-mono text-xs text-ink-3">
                  {formatDayRelative(activity.occurredOn, refDay)}
                </span>
                {activity.source === "strava" && (
                  <span
                    style={{ color: "#FC5200" }}
                    className="eyebrow text-[0.625rem]"
                  >
                    Strava
                  </span>
                )}
              </div>
              <div className="text-[0.9375rem] text-ink-2">
                {isFlat
                  ? `${ui.label} workout`
                  : `${fmtKm(activity.km)} km ${ui.label.toLowerCase()}`}
                {activity.note ? ` — ${activity.note}` : ""}
              </div>
              {isUnscored && (
                <div className="mt-1 text-[0.8125rem] text-ink-3">
                  Past the {MAX_SCORING_GYM_PER_DAY}-a-day gym cap — logged, not scored.
                </div>
              )}
            </div>
            <div className="text-right">
              <div
                className={`stamp text-xl ${
                  isUnscored ? "text-ink-3 line-through" : ui.text
                }`}
              >
                {fmtPoints(activityPoints(activity, state.settings, unscored))}
              </div>
              <div className="eyebrow text-ink-3">pts</div>
            </div>
            {canManage && !confirmDelete && (
              <button
                onClick={() => {
                  setDelErr(null);
                  setConfirmDelete(true);
                }}
                disabled={busy}
                aria-label="Delete session"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-tile text-ink-3 disabled:opacity-40"
              >
                <Glyph name="trash" className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>

          {/* Delete confirm */}
          {confirmDelete && (
            <div className="mb-2.5 flex items-center gap-2 rounded-xl border-2 border-run/50 bg-run/5 px-3 py-2.5">
              <span className="flex-1 text-[0.8125rem] text-ink">
                Delete this session? It leaves the board for good.
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="eyebrow rounded-lg px-3 py-1.5 text-ink-2 disabled:opacity-40"
              >
                Keep
              </button>
              <button
                onClick={remove}
                disabled={busy}
                className="eyebrow rounded-lg bg-run px-3 py-1.5 text-tile disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
          {delErr && <p className="mb-2 text-xs font-medium text-run">{delErr}</p>}

          {/* Reactions */}
          <div className="flex gap-2 border-y border-line py-2.5">
            {REACTIONS.map((type) => {
              const on = mine === type;
              const n = counts[type];
              return (
                <button
                  key={type}
                  onClick={() => react(type)}
                  disabled={busy}
                  aria-pressed={on}
                  aria-label={REACTION_LABEL[type]}
                  className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 transition-colors ${
                    on
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line bg-tile text-ink-2"
                  }`}
                >
                  <Glyph name={REACTION_GLYPH[type]} className="h-4 w-4" />
                  {n > 0 && <span className="font-mono text-xs">{n}</span>}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-1.5 self-center text-ink-3">
              <Glyph name="chat" className="h-4 w-4" />
              <span className="font-mono text-xs">{comments.length}</span>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">
              {total > 0 ? "Reactions only — no words yet." : "Be the first to say something."}
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const author = athleteOf.get(c.athleteId);
                const canDelete = c.athleteId === state.me?.id || state.isAdmin;
                return (
                  <li key={c.id} className="flex gap-2.5">
                    {author && (
                      <Avatar athlete={author} className="mt-0.5 h-7 w-7 text-[0.5625rem]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {nameOf.get(c.athleteId) ?? "Unknown"}
                        </span>
                        <span className="font-mono text-[0.625rem] text-ink-3">
                          {timeAgo(c.createdAt)}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => send(`/api/comments/${c.id}`, { method: "DELETE" })}
                            className="ml-auto font-mono text-[0.625rem] text-ink-3"
                          >
                            delete
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-[0.9375rem] text-ink">
                        {c.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t-2 border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {error && <p className="mb-2 text-xs font-medium text-run">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_COMMENT}
              rows={1}
              placeholder="Add a comment…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border-2 border-ink-3 bg-tile px-3 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <button
              onClick={addComment}
              disabled={busy || !text.trim()}
              className="accent-fill eyebrow rounded-xl px-4 py-3 shadow-sm transition-opacity disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
