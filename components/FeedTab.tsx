"use client";

import { useMemo, useState } from "react";
import { activityPoints, fmtKm, fmtPoints, unscoredGymIds } from "@/lib/scoring";
import { SPORT_UI, GRANT_HATCH } from "@/lib/ui";
import { formatDayRelative, type DayKey } from "@/lib/dates";
import { SPORT_UNIT, isGrant, type Activity, type Athlete } from "@/lib/types";
import { MAX_SCORING_GYM_PER_DAY } from "@/lib/validate";
import { athleteColor } from "@/lib/avatar";
import { SportMark } from "./SportMark";
import { Avatar } from "./Avatar";
import { AthleteName } from "./ProfileContext";
import { ActivitySheet } from "./ActivitySheet";
import type { League } from "./useLeague";

const PAGE = 60;

export function FeedTab({ league, refDay }: { league: League; refDay: DayKey }) {
  const { state } = league;
  const [openId, setOpenId] = useState<string | null>(null);

  const athleteById = useMemo(() => {
    const map = new Map<string, Athlete>();
    for (const a of state.athletes) map.set(a.id, a);
    return map;
  }, [state.athletes]);

  // Gym workouts past the daily cap — shown, but marked as scoring nothing.
  const unscored = useMemo(() => unscoredGymIds(state.activities), [state.activities]);

  const days = useMemo(() => {
    const groups = new Map<DayKey, Activity[]>();
    for (const a of state.activities.slice(0, PAGE)) {
      const list = groups.get(a.occurredOn);
      if (list) list.push(a);
      else groups.set(a.occurredOn, [a]);
    }
    return [...groups.entries()];
  }, [state.activities]);

  const openActivity = state.activities.find((a) => a.id === openId) ?? null;

  if (days.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-line px-4 py-12 text-center text-sm text-ink-2">
        Quiet so far. The feed fills up as everyone logs.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {days.map(([day, items]) => {
        const dayPoints = items.reduce(
          (sum, a) => sum + activityPoints(a, state.settings, unscored),
          0,
        );
        return (
          <section key={day}>
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
              <h2 className="eyebrow text-ink">{formatDayRelative(day, refDay)}</h2>
              <span className="font-mono text-xs text-ink-2">{fmtPoints(dayPoints)} pts</span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {items.map((a) => {
                const isMe = a.athleteId === state.me?.id;
                const author = athleteById.get(a.athleteId);

                // Admin grants aren't sessions — no sport, no distance, and no
                // detail sheet to open. Render them as an award row.
                if (isGrant(a)) {
                  const laneColor = author?.avatarColor ?? athleteColor({ id: a.athleteId });
                  return (
                    <li
                      key={a.id}
                      className="rounded-xl bg-tile px-3 py-2.5"
                      style={{
                        backgroundColor: `${laneColor}1a`,
                        boxShadow: `inset 3px 0 0 ${laneColor}`,
                      }}
                    >
                      <div className="flex w-full items-center gap-3">
                        {author ? (
                          <div className="relative shrink-0">
                            <Avatar athlete={author} me={isMe} className="h-10 w-10 text-xs" />
                            <span
                              aria-hidden
                              className="absolute -bottom-1 -right-1 h-[18px] w-[18px] rounded-full border-2 border-deck ring-1 ring-line"
                              style={{ backgroundImage: GRANT_HATCH }}
                            />
                          </div>
                        ) : (
                          <span
                            aria-hidden
                            className="h-[18px] w-[18px] rounded-[4px] ring-1 ring-line"
                            style={{ backgroundImage: GRANT_HATCH }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">
                            {author ? (
                              <AthleteName id={author.id} name={author.name} className="font-semibold" />
                            ) : (
                              <span className="font-semibold">Unknown</span>
                            )}
                            {isMe && <span className="text-ink-3"> · you</span>}
                            <span className="text-ink-2"> — awarded by admin</span>
                          </p>
                          {a.note && (
                            <p className="truncate text-[0.8125rem] text-ink-3">{a.note}</p>
                          )}
                        </div>
                        <span className="stamp shrink-0 text-base text-ink-2">
                          {fmtPoints(a.points ?? 0)}
                        </span>
                      </div>
                    </li>
                  );
                }

                const ui = SPORT_UI[a.sport];
                // Tint each row by the poster's avatar colour so the feed
                // reads like a colour-coded stream. Two layers: a soft wash
                // (`1a` ≈ 10% alpha) and a crisp 3px inset stripe on the
                // left as the identity anchor. boxShadow keeps padding intact.
                const laneColor = author?.avatarColor ?? athleteColor({ id: a.athleteId });
                return (
                  <li
                    key={a.id}
                    className="rounded-xl bg-tile px-3 py-2.5"
                    style={{
                      backgroundColor: `${laneColor}1a`,
                      boxShadow: `inset 3px 0 0 ${laneColor}`,
                    }}
                  >
                    <button
                      onClick={() => setOpenId(a.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      {author ? (
                        <div className="relative shrink-0">
                          <Avatar athlete={author} me={isMe} className="h-10 w-10 text-xs" />
                          <span
                            className={`absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-deck text-white ${ui.bg}`}
                          >
                            <SportMark sport={a.sport} className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      ) : (
                        <span className={ui.text}>
                          <SportMark sport={a.sport} className="h-[18px] w-[18px]" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">
                          {author ? (
                            <AthleteName id={author.id} name={author.name} className="font-semibold" />
                          ) : (
                            <span className="font-semibold">Unknown</span>
                          )}
                          {isMe && <span className="text-ink-3"> · you</span>}
                          <span className="text-ink-2">
                            {" "}
                            —{" "}
                            {SPORT_UNIT[a.sport] === "flat"
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
                        {unscored.has(a.id) && (
                          <p className="text-[0.8125rem] text-ink-3">
                            Past the {MAX_SCORING_GYM_PER_DAY}-a-day gym cap — logged, not scored.
                          </p>
                        )}
                      </div>
                      <span
                        className={`stamp shrink-0 text-base ${
                          unscored.has(a.id) ? "text-ink-3 line-through" : ui.text
                        }`}
                      >
                        {fmtPoints(activityPoints(a, state.settings, unscored))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {state.activities.length > PAGE && (
        <p className="text-center font-mono text-xs text-ink-3">
          Showing the most recent {PAGE} sessions.
        </p>
      )}

      {openActivity && (
        <ActivitySheet
          league={league}
          activity={openActivity}
          refDay={refDay}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
