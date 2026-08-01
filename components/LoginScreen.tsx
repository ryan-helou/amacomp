"use client";

import { useState } from "react";
import { SPORT_ORDER } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import { SPORT_UNIT, UNIT_LABEL, type Settings } from "@/lib/types";
import { formatDay } from "@/lib/dates";
import { SportMark } from "./SportMark";

export function LoginScreen({
  settings,
  busy,
  onSubmit,
}: {
  settings: Settings;
  busy: boolean;
  onSubmit: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(await onSubmit(name));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <p className="eyebrow text-ink-2">Triathlon standings</p>
      {/* `accent-text` paints the gradient with background-clip:text, which
          clips to the element's background box — not to the glyphs. At 15vw the
          word ran ~14px wider than that box, so the tail of the P had no
          gradient to paint and simply vanished ("AMACOMF"). inline-block makes
          the box hug the text, and the smaller step keeps it inside the gutters
          on a 320px phone. */}
      <h1 className="stamp accent-text mt-2 inline-block w-fit text-[clamp(2.25rem,13vw,3.75rem)] leading-[0.85]">
        AMACOMP
      </h1>
      <p className="mt-4 max-w-xs text-[0.9375rem] leading-snug text-ink-2">
        Log every kilometre you swim, ride and run, plus every gym workout.
        Points land on the board the moment you save them.
      </p>

      <div className="spectrum-bar mt-8 h-1 w-full rounded-full" />

      <ul className="mt-5 space-y-2">
        {SPORT_ORDER.map((sport) => (
          <li key={sport} className="flex items-center gap-3">
            <span className={`${SPORT_UI[sport].text}`}>
              <SportMark sport={sport} className="h-[18px] w-[18px]" />
            </span>
            <span className="eyebrow w-12 text-ink">{SPORT_UI[sport].label}</span>
            <span className="font-mono text-sm text-ink-2">
              {settings.multipliers[sport]} pt{settings.multipliers[sport] === 1 ? "" : "s"} / {UNIT_LABEL[SPORT_UNIT[sport]]}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-sm text-ink-2">
        Weekly quota&nbsp;·&nbsp;
        <span className="text-ink">{settings.weeklyGoal} pts</span>
      </p>
      <p className="mt-3 text-[0.8125rem] leading-snug text-ink-2">
        Log from today — it all counts. Kickoff{" "}
        <span className="font-semibold text-ink">{formatDay(settings.seasonStart)}</span>. Miss
        your weekly quota and the forfeit is{" "}
        <span className="font-semibold text-run">{settings.forfeit}</span>.
      </p>

      <form onSubmit={submit} className="mt-9">
        <label htmlFor="name" className="eyebrow block text-ink-2">
          Your name
        </label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="go"
          placeholder="Ryan"
          className="mt-2 w-full rounded-xl border-2 border-ink bg-tile px-4 py-3.5 text-lg text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-3 focus-visible:outline-ink"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-run">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="accent-fill eyebrow mt-4 w-full rounded-xl px-4 py-4 shadow-sm transition-opacity disabled:opacity-40"
        >
          {busy ? "Checking you in…" : "Enter the league"}
        </button>
      </form>

      <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-3">
        No password. Type the same name each time and your history follows you.
      </p>
    </main>
  );
}
