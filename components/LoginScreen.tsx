"use client";

import { useState } from "react";
import { SPORT_ORDER } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import type { Settings } from "@/lib/types";
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
      <h1 className="stamp mt-2 text-[4.25rem] leading-[0.85] text-ink">
        AMAGOH
      </h1>
      <p className="mt-4 max-w-xs text-[0.9375rem] leading-snug text-ink-2">
        Log every kilometre you swim, ride and run. Points land on the board the
        moment you save them.
      </p>

      <div className="mt-8 h-px w-full bg-line" />

      <ul className="mt-5 space-y-2">
        {SPORT_ORDER.map((sport) => (
          <li key={sport} className="flex items-center gap-3">
            <span className={`${SPORT_UI[sport].text}`}>
              <SportMark sport={sport} className="h-[18px] w-[18px]" />
            </span>
            <span className="eyebrow w-12 text-ink">{SPORT_UI[sport].label}</span>
            <span className="font-mono text-sm text-ink-2">
              {settings.multipliers[sport]} pt{settings.multipliers[sport] === 1 ? "" : "s"} / km
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-sm text-ink-2">
        Weekly quota&nbsp;·&nbsp;
        <span className="text-ink">{settings.weeklyGoal} pts</span>
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
          className="eyebrow mt-4 w-full rounded-xl bg-ink px-4 py-4 text-tile transition-opacity disabled:opacity-40"
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
