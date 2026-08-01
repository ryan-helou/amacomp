"use client";

import { useMemo, useState } from "react";
import { SPORT_ORDER, fmtKm, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, UNIT_LABEL, type AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { monthlyChampions, weekWinsBoard } from "@/lib/achievements";
import { hallOfFame } from "@/lib/records";
import { seasonChampions } from "@/lib/season";
import { teamTotals } from "@/lib/stats";
import { AthleteName, useOpenProfile } from "./ProfileContext";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { SportMark } from "./SportMark";
import { RecordSheet } from "./RecordSheet";

export function TitlesTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const openProfile = useOpenProfile();
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [showUnclaimed, setShowUnclaimed] = useState(false);

  const athleteById = useMemo(
    () => new Map(state.athletes.map((a) => [a.id, a])),
    [state.athletes],
  );
  const records = useMemo(
    () => hallOfFame(state.activities, state.settings),
    [state.activities, state.settings],
  );
  const shownRecords = useMemo(() => records.filter((r) => r.holderId), [records]);
  const unclaimed = useMemo(() => records.filter((r) => !r.holderId), [records]);
  const seasons = useMemo(
    () =>
      seasonChampions(
        state.athletes,
        state.activities,
        state.settings,
        refDay,
        state.settings.seasonStart,
      ),
    [state.athletes, state.activities, state.settings, refDay],
  );

  const wins = useMemo(
    () => weekWinsBoard(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );
  const months = useMemo(
    () => monthlyChampions(state.athletes, state.activities, state.settings, refDay),
    [state.athletes, state.activities, state.settings, refDay],
  );
  const team = useMemo(
    () => teamTotals(state.athletes, state.activities, state.settings),
    [state.athletes, state.activities, state.settings],
  );

  const anyWins = wins.some((w) => w.wins > 0);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center gap-2">
          <span className="text-gold" aria-hidden>
            <Glyph name="medal" className="h-5 w-5" />
          </span>
          <h2 className="stamp text-xl text-gold">HALL OF FAME</h2>
        </div>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          All-time records. Beat one and your name goes up.
        </p>
        <ul className="mt-3 space-y-2">
          {shownRecords.map((r) => {
            const holder = r.holderId ? athleteById.get(r.holderId) : null;
            const shown = r.unit === "km" ? fmtKm(r.value) : fmtPoints(r.value);
            const body = (
              <>
                <span className="shrink-0 text-gold">
                  {r.sport ? (
                    <SportMark sport={r.sport} className="h-6 w-6" />
                  ) : r.glyph ? (
                    <Glyph name={r.glyph} className="h-6 w-6" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow text-ink-2">{r.label}</div>
                  {holder ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Avatar athlete={holder} className="h-5 w-5 text-[0.5rem]" />
                      <span className="truncate text-[0.8125rem] font-semibold text-ink">
                        {holder.name}
                      </span>
                      <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">
                        {r.detail}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[0.8125rem] text-ink-3">Unclaimed — go get it.</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="stamp text-xl text-gold">{holder ? shown : "—"}</div>
                  <div className="eyebrow text-ink-3">{r.unit}</div>
                </div>
              </>
            );
            const cls =
              "flex w-full items-center gap-3 rounded-xl border-2 border-gold/40 bg-gold/5 px-4 py-3 text-left";
            return (
              <li key={r.key}>
                {holder ? (
                  <button
                    onClick={() => setOpenRecord(r.key)}
                    aria-label={`How ${holder.name} set the ${r.label} record`}
                    className={cls}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Unclaimed records collapse into one line. On day one every record is
            unclaimed, and nine identical "go get it" rows is an empty shelf —
            this keeps it a trophy case that fills up, without hiding anything. */}
        {unclaimed.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowUnclaimed((v) => !v)}
              aria-expanded={showUnclaimed}
              className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-3 text-left"
            >
              <span className="eyebrow flex-1 text-ink-2">
                {unclaimed.length} record{unclaimed.length === 1 ? "" : "s"} up for grabs
              </span>
              <span className="eyebrow text-ink-3">{showUnclaimed ? "Hide" : "Show"}</span>
            </button>
            {showUnclaimed && (
              <ul className="mt-2 space-y-1.5">
                {unclaimed.map((r) => (
                  <li
                    key={r.key}
                    className="flex items-center gap-3 rounded-xl border-2 border-line bg-tile px-4 py-2.5"
                  >
                    <span className="shrink-0 text-ink-3">
                      {r.sport ? (
                        <SportMark sport={r.sport} className="h-5 w-5" />
                      ) : r.glyph ? (
                        <Glyph name={r.glyph} className="h-5 w-5" />
                      ) : null}
                    </span>
                    <span className="eyebrow flex-1 text-ink-2">{r.label}</span>
                    <span className="eyebrow shrink-0 text-ink-3">{r.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <section>
        <h2 className="eyebrow text-ink-2">Together so far</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border-2 border-ink bg-tile px-4 py-3">
            <div className="stamp accent-text text-2xl">{fmtKm(team.distanceKm)}</div>
            <div className="eyebrow mt-0.5 text-ink-3">km on the move</div>
          </div>
          <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
            <div className="stamp text-2xl text-ink">{team.sessions}</div>
            <div className="eyebrow mt-0.5 text-ink-3">sessions logged</div>
          </div>
        </div>
        {team.sessions > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border-2 border-line bg-tile px-4 py-3 font-mono text-xs">
            {SPORT_ORDER.map((s) => {
              const amt = team.kmBySport[s];
              if (amt <= 0) return null;
              return (
                <span key={s} className={SPORT_UI[s].text}>
                  {SPORT_UI[s].label} {fmtKm(amt)} {UNIT_LABEL[SPORT_UNIT[s]]}
                </span>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <h2 className="eyebrow text-ink-2">Most week wins</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Every completed week crowns a champion. This is the all-time count.
        </p>

        {!anyWins ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            No weeks in the books yet. The first champion is crowned when this week
            closes.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {wins.map((row) => {
              const isMe = row.athlete.id === state.me?.id;
              const has = row.wins > 0;
              return (
                <li key={row.athlete.id}>
                  <button
                    onClick={() => openProfile(row.athlete.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left ${
                      isMe ? "border-ink bg-tile" : "border-line bg-tile"
                    }`}
                  >
                    <span
                      className={`stamp w-6 text-center text-xl ${
                        row.rank === 1 && has ? "text-gold" : "text-ink-3"
                      }`}
                    >
                      {has ? row.rank : "—"}
                    </span>
                    <Avatar athlete={row.athlete} me={isMe} />
                    <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">
                      {row.athlete.name}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-ink-2">you</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-right">
                      {row.wins > 0 && (
                        <span className="text-gold">
                          <Glyph name="trophy" className="h-4 w-4" />
                        </span>
                      )}
                      <span className="font-mono text-sm text-ink-2">
                        {row.wins} win{row.wins === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section>
        <h2 className="eyebrow text-ink-2">Seasons</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Every two months is a new season. Winner eats free and wears{" "}
          <span className="font-semibold text-gold">gold</span> all next season. Last place
          cooks — everyone chips in but the champ.
        </p>
        <ul className="mt-3 space-y-2">
          {seasons.map((s) => (
            <li
              key={s.season.number}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                s.status === "live"
                  ? "border-accent/40 bg-accent/5"
                  : s.champion
                    ? "border-gold/40 bg-gold/5"
                    : "border-line bg-tile"
              }`}
            >
              <span className={s.status === "live" ? "text-accent" : "text-gold"} aria-hidden>
                <Glyph name={s.status === "live" ? "flame" : "trophy"} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="eyebrow text-ink-2">
                    {s.season.label} · {s.season.monthsLabel}
                  </span>
                  {s.status === "live" && (
                    <span className="eyebrow rounded bg-accent/12 px-1.5 py-0.5 text-[0.5625rem] accent-text">
                      Live
                    </span>
                  )}
                  {s.status === "upcoming" && (
                    <span className="eyebrow rounded bg-deck-2 px-1.5 py-0.5 text-[0.5625rem] text-ink-3">
                      Soon
                    </span>
                  )}
                </div>
                <div className="stamp text-lg text-ink">
                  {s.champion ? (
                    <AthleteName id={s.champion.athlete.id} name={s.champion.athlete.name} />
                  ) : s.status === "upcoming" ? (
                    "Not open yet"
                  ) : (
                    "Up for grabs"
                  )}
                </div>
              </div>
              {s.champion && (
                <div className="text-right">
                  <div className={`stamp text-lg ${s.status === "live" ? "accent-text" : "text-gold"}`}>
                    {fmtPoints(s.champion.points)}
                  </div>
                  <div className="eyebrow text-ink-3">pts</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="eyebrow text-ink-2">Monthly champions</h2>
        {months.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            The monthly hall of fame fills up as the months roll by.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {months.map((m) => (
              <li
                key={m.monthKey}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
                  m.isCurrent ? "border-accent/40 bg-accent/5" : "border-gold/40 bg-gold/5"
                }`}
              >
                <span className={m.isCurrent ? "text-accent" : "text-gold"} aria-hidden>
                  <Glyph name={m.isCurrent ? "flame" : "trophy"} className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="eyebrow text-ink-2">{m.label}</span>
                    {m.isCurrent && (
                      <span className="eyebrow rounded bg-accent/12 px-1.5 py-0.5 text-[0.5625rem] accent-text">
                        Leading
                      </span>
                    )}
                  </div>
                  <div className="stamp text-lg text-ink">
                    <AthleteName id={m.champion.athlete.id} name={m.champion.athlete.name} />
                  </div>
                </div>
                <div className="text-right">
                  <div className={`stamp text-lg ${m.isCurrent ? "accent-text" : "text-gold"}`}>
                    {fmtPoints(m.champion.points)}
                  </div>
                  <div className="eyebrow text-ink-3">pts</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {openRecord &&
        (() => {
          const r = records.find((x) => x.key === openRecord);
          if (!r) return null;
          return (
            <RecordSheet record={r} state={state} onClose={() => setOpenRecord(null)} />
          );
        })()}
    </div>
  );
}
