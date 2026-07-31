"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { SPORT_ORDER } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import {
  AVATAR_PALETTE,
  SPORT_UNIT,
  UNIT_ABBR,
  type Settings,
} from "@/lib/types";
import { SportMark } from "./SportMark";
import { NotificationSetup } from "./NotificationSetup";
import { StravaSetup } from "./StravaSetup";
import { Avatar } from "./Avatar";
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
    seasonStart: state.settings.seasonStart,
    forfeit: state.settings.forfeit,
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
      seasonStart: form.seasonStart,
      forfeit: form.forfeit,
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
          <h2 className="stamp accent-text text-2xl">SCORING</h2>
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

          <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
            <label htmlFor="season" className="eyebrow block text-ink-2">
              Kickoff date
            </label>
            <input
              id="season"
              type="date"
              readOnly={!editable}
              value={form.seasonStart}
              onChange={(e) => setForm({ ...form, seasonStart: e.target.value })}
              className={`mt-2 block w-full appearance-none rounded-lg border-2 px-3 py-2 text-ink [color-scheme:light] focus:outline-none ${
                editable ? "border-ink-3 bg-tile focus:border-accent" : "border-transparent bg-transparent"
              }`}
            />
            <p className="mt-1.5 text-[0.6875rem] text-ink-3">
              Shown on the sign-in screen. Logging counts from day one.
            </p>
          </div>

          <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
            <label htmlFor="forfeit" className="eyebrow block text-ink-2">
              Loser&apos;s forfeit
            </label>
            <input
              id="forfeit"
              type="text"
              maxLength={120}
              readOnly={!editable}
              value={form.forfeit}
              onChange={(e) => setForm({ ...form, forfeit: e.target.value })}
              placeholder="What the weekly loser owes"
              className={`mt-2 block w-full rounded-lg border-2 px-3 py-2 text-ink focus:outline-none ${
                editable ? "border-ink-3 bg-tile focus:border-accent" : "border-transparent bg-transparent px-0"
              }`}
            />
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
            className="accent-fill eyebrow mt-5 w-full rounded-xl px-4 py-4 shadow-sm disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save scoring"}
          </button>
        )}

        <div className="mt-6 border-t border-line pt-4">
          <NotificationSetup />
        </div>

        <div className="mt-4">
          <StravaSetup league={league} />
        </div>

        <div className="mt-4">
          <AvatarPicker league={league} />
        </div>

        <div className="mt-4 rounded-xl border-2 border-line bg-tile px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="reset" className="eyebrow block text-ink">
                Your day starts at
              </label>
              <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                Late-night sessions before this count for the day before.
              </p>
            </div>
            <select
              id="reset"
              value={String(state.me?.resetHour ?? 0)}
              disabled={busy}
              onChange={(e) =>
                send("/api/session", {
                  method: "PATCH",
                  body: JSON.stringify({ resetHour: Number(e.target.value) }),
                })
              }
              className="shrink-0 rounded-lg border-2 border-ink-3 bg-tile px-2 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {[0, 1, 2, 3].map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? "12 AM" : `${h} AM`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
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

/**
 * Set a profile photo — upload your own, or fall back to your Strava photo, then
 * initials. The lane colour still tints your feed posts and backs the initials.
 * Everything saves optimistically through the shared league.send flow.
 */
function AvatarPicker({ league }: { league: League }) {
  const { state, busy, send } = league;
  const me = state.me;
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  if (!me) return null;

  const previewAthlete = {
    id: me.id,
    name: me.name,
    avatarColor: me.avatarColor,
    avatarUrl: me.avatarUrl,
  };
  const hasUploaded = !!me.avatarUrl && me.avatarUrl.startsWith("/api/avatar/");

  function saveColor(color: string) {
    send("/api/session", {
      method: "PATCH",
      body: JSON.stringify({ avatarColor: color }),
    });
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a cancel
    if (!file) return;
    setPhotoErr(null);
    try {
      const image = await resizeToSquare(file, 512);
      const err = await send("/api/avatar", {
        method: "POST",
        body: JSON.stringify({ image }),
      });
      if (err) setPhotoErr(err);
    } catch {
      setPhotoErr("Couldn't read that image — try another.");
    }
  }

  async function removePhoto() {
    setPhotoErr(null);
    await send("/api/avatar", { method: "DELETE" });
  }

  return (
    <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar athlete={previewAthlete} me className="h-12 w-12 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-ink">Your avatar</div>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">
            {state.strava.connected
              ? "Defaults to your Strava photo — upload to override."
              : "Upload a photo, or it falls back to your initials."}
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPickFile}
        className="hidden"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="eyebrow flex-1 rounded-lg border-2 border-line bg-tile px-3 py-2.5 text-ink-2 transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? "Working…" : hasUploaded ? "Change photo" : "Upload photo"}
        </button>
        {hasUploaded && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={busy}
            className="eyebrow rounded-lg px-3 py-2.5 text-ink-3 disabled:opacity-40"
          >
            Remove
          </button>
        )}
      </div>
      {photoErr && <p className="mt-2 text-xs font-medium text-run">{photoErr}</p>}

      <div className="mt-3">
        <div className="eyebrow mb-1.5 text-ink-3">Lane colour</div>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_PALETTE.map((c) => {
            const active = me.avatarColor === c;
            return (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={active}
                disabled={busy}
                onClick={() => saveColor(c)}
                style={{ backgroundColor: c }}
                className={`h-9 w-full rounded-lg border-2 transition-transform active:scale-95 disabled:opacity-40 ${
                  active ? "border-ink" : "border-transparent"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Draw the picked file to a centred, cover-cropped square and hand back a
 *  compact JPEG data URL — keeps uploads tiny and dependency-free (no server
 *  image lib). */
function resizeToSquare(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}
