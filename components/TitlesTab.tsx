"use client";

import { useMemo } from "react";
import { SPORT_ORDER, fmtKm, fmtPoints } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, UNIT_LABEL, rateLabel, type AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { monthlyChampions, weekWinsBoard } from "@/lib/achievements";
import { hallOfFame } from "@/lib/records";
import { seasonChampions } from "@/lib/season";
import { teamTotals } from "@/lib/stats";
import { AthleteName, useOpenProfile } from "./ProfileContext";
import { Glyph } from "./Glyph";
import { Avatar } from "./Avatar";
import { SportMark } from "./SportMark";

export function TitlesTab({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const openProfile = useOpenProfile();

  const athleteById = useMemo(
    () => new Map(state.athletes.map((a) => [a.id, a])),
    [state.athletes],
  );
  const records = useMemo(
    () => hallOfFame(state.activities, state.settings),
    [state.activities, state.settings],
  );
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
      {/* House rules — the pact the lads play by */}
      <section className="overflow-hidden rounded-2xl border-2 border-ink bg-tile">
        <div className="flex items-center justify-between border-b-2 border-line bg-deck-2/50 px-5 py-3">
          <div>
            <p className="eyebrow text-ink-3">The pact</p>
            <h2 className="stamp text-2xl text-ink">House Rules</h2>
          </div>
          <span className="text-gold" aria-hidden>
            <Glyph name="shield" className="h-8 w-8" />
          </span>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* The weekly law */}
          <div className="flex items-center gap-4">
            <div className="stat shrink-0 leading-none text-ink" style={{ fontSize: "3.5rem" }}>
              {fmtPoints(state.settings.weeklyGoal)}
            </div>
            <div className="min-w-0">
              <p className="eyebrow accent-text">points · every week</p>
              <p className="mt-1 text-sm text-ink-2">
                Fall short and you owe:{" "}
                <span className="font-semibold text-ink">{state.settings.forfeit}</span>
              </p>
            </div>
          </div>

          <div className="h-px bg-line" />

          {/* End-of-season stakes */}
          <div>
            <p className="eyebrow mb-2 text-ink-3">End of season</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 rounded-xl border-2 border-gold/40 bg-gold/5 px-4 py-3">
                <span className="mt-0.5 shrink-0 text-gold" aria-hidden>
                  <Glyph name="crown" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gold">First place eats free</p>
                  <p className="text-[0.8125rem] text-ink-2">
                    …and their name shines <span className="font-semibold text-gold">gold</span>{" "}
                    all next season.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border-2 border-line bg-deck-2/40 px-4 py-3">
                <span className="mt-0.5 shrink-0 text-run" aria-hidden>
                  <Glyph name="flame" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Last place cooks the meal</p>
                  <p className="text-[0.8125rem] text-ink-2">
                    The whole crew chips in for it — everyone but the champ.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="border-t border-line pt-3 text-center font-mono text-[0.6875rem] text-ink-3">
            {SPORT_ORDER.map(
              (s) =>
                `${SPORT_UI[s].label.toLowerCase()} ${rateLabel(state.settings.multipliers[s], SPORT_UNIT[s])}`,
            ).join("  ·  ")}
          </p>
        </div>
      </section>

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
          {records.map((r) => {
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
                  <button onClick={() => openProfile(holder.id)} className={cls}>
                    {body}
                  </button>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
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

    </div>
  );
}
