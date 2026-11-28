"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { SPORT_ORDER, ratesOn } from "@/lib/scoring";
import { SPORT_UI } from "@/lib/ui";
import {
  AVATAR_PALETTE,
  SPORT_UNIT,
  UNIT_ABBR,
  type Sport,
} from "@/lib/types";
import { formatDay, type DayKey } from "@/lib/dates";
import { BibleMissed } from "./BibleMissed";
import { SportMark } from "./SportMark";
import { Glyph } from "./Glyph";
import { NotificationSetup } from "./NotificationSetup";
import { StravaSetup } from "./StravaSetup";
import { Avatar } from "./Avatar";
import { PalettePicker } from "./PalettePicker";
import { FestivePreview } from "./Festive";
import type { League } from "./useLeague";

/**
 * The rules panel. Everyone can read the scoring; only the admin gets inputs —
 * enforced on the server too, this is just the matching interface.
 */

/** What a save sends. Notably NOT a whole `Settings`: the base rates and the
 *  dated change list are the server's to work out, so this shape can't carry
 *  them and a save can't rewrite the season by accident. */
interface SettingsInput {
  multipliers: Record<Sport, number>;
  elevationPer100m: Record<Sport, number>;
  /** Retroactive by instruction — see Settings.openWaterPerKm. */
  openWaterPerKm: number;
  weeklyGoal: number;
  seasonStart: string;
  forfeit: string;
}
/** Sport -> its key in the flat `form` object. Kept explicit so the form stays
 *  a flat record of strings (no nested state) without stringly-typed indexing. */
const CLIMB_KEY = {
  swim: "climbSwim", bike: "climbBike", run: "climbRun", gym: "climbGym",
} as const satisfies Record<Sport, string>;

export function ScoringSheet({
  league,
  refDay,
  logDay,
  onClose,
  onOpenRules,
}: {
  league: League;
  /** Today. The inputs show the rates in force NOW, and a save takes effect from
   *  here forward — the base rates in `settings` may be an older era's. */
  refDay: DayKey;
  /** The day a session logged now counts for — the Bible box's "today". */
  logDay: DayKey;
  onClose: () => void;
  /** Swap this sheet for the House Rules one — the rules are the clearest
   *  explainer in the app and the header "?" is easy to miss. */
  onOpenRules: () => void;
}) {
  const { state, busy, send } = league;
  const editable = state.isAdmin;

  // Seed from the rates in force TODAY, not the base rates — after a dated
  // change those are two different things, and the box has to show what is
  // actually being scored right now.
  const liveRates = ratesOn(refDay, state.settings);
  // Changes that haven't started yet, so the admin can see what is already
  // queued instead of scheduling a second one on top of it.
  const upcoming = (state.settings.rateChanges ?? []).filter((c) => c.from > refDay);

  const [form, setForm] = useState(() => ({
    swim: String(liveRates.multipliers.swim),
    bike: String(liveRates.multipliers.bike),
    run: String(liveRates.multipliers.run),
    gym: String(liveRates.multipliers.gym),
    climbSwim: String(liveRates.elevationPer100m?.swim ?? 0),
    climbBike: String(liveRates.elevationPer100m?.bike ?? 0),
    climbRun: String(liveRates.elevationPer100m?.run ?? 0),
    climbGym: String(liveRates.elevationPer100m?.gym ?? 0),
    openWater: String(state.settings.openWaterPerKm ?? 20),
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
    // Only the editable fields go over the wire. The server keeps the base rates
    // and records any change as dated, so this deliberately can't send one.
    const payload: SettingsInput = {
      multipliers: {
        swim: Number(form.swim),
        bike: Number(form.bike),
        run: Number(form.run),
        gym: Number(form.gym),
      },
      elevationPer100m: {
        swim: Number(form.climbSwim),
        bike: Number(form.climbBike),
        run: Number(form.climbRun),
        gym: Number(form.climbGym),
      },
      openWaterPerKm: Number(form.openWater),
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
        className="absolute inset-0 bg-scrim"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scoring"
        className="relative max-h-[88dvh] overflow-y-auto glass-raised rounded-t-3xl border-t border-line-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3" />

        <div className="flex items-baseline justify-between">
          <h2 className="stamp accent-text text-2xl">SETTINGS</h2>
          <button onClick={onClose} className="eyebrow text-ink-2">
            Close
          </button>
        </div>

        {/* The rules deserve a labelled door, not just the "?" in the header. */}
        <button
          onClick={onOpenRules}
          className="mt-4 flex w-full items-center gap-3 rounded-xl pane border border-line-2 bg-tile px-4 py-3 text-left"
        >
          <span className="text-gold">
            <Glyph name="trophy" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block text-ink">House rules</span>
            <span className="mt-0.5 block text-[0.8125rem] text-ink-2">
              The quota, the forfeit, and what the season winner gets.
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-ink-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        <BibleMissed league={league} logDay={logDay} />

        <div className="mt-6 border-t border-line pt-4">
          <NotificationSetup />
        </div>

        <div className="mt-4">
          <StravaSetup league={league} />
        </div>

        <div className="mt-4">
          <AvatarPicker league={league} />
        </div>

        <PalettePicker />

        {state.isAdmin && <FestivePreview />}

        <NameField league={league} />

        {/* Weight — only ever used to divide watts into W/kg for the Records
            tab. Pulled from Strava on connect where it's set; this is the
            override, and the only way in for anyone Strava has nothing for. */}
        <div className="mt-4 rounded-xl pane border border-line bg-tile px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="weight" className="eyebrow block text-ink">
                Your weight
              </label>
              <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                Only used for the watts-per-kilo records. Blank leaves them unset.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                min={25}
                max={250}
                step="0.1"
                defaultValue={state.me?.weightKg ?? ""}
                disabled={busy}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const next = raw === "" ? null : Number(raw);
                  if (next !== null && !Number.isFinite(next)) return;
                  if ((state.me?.weightKg ?? null) === next) return;
                  void send("/api/session", {
                    method: "PATCH",
                    body: JSON.stringify({ weightKg: next }),
                  });
                }}
                className="w-20 rounded-lg pane border border-line-2 bg-tile px-2 py-2 text-right text-sm text-ink focus:border-accent focus:outline-none"
              />
              <span className="eyebrow text-ink-3">kg</span>
            </div>
          </div>
        </div>

        {/* The day rollover used to be a per-athlete picker here. It is now one
            fixed hour for the whole league (RESET_HOUR) — a shared board only
            reads as fair when a given moment means the same thing on everyone's
            screen. The rule is stated in the house rules instead. */}

        {/* Scoring sits last: only the admin can change it, so for everyone
            else it's reference material, not a control. */}
        <div className="mt-7 border-t border-line pt-4">
          <h3 className="eyebrow text-ink-2">Scoring</h3>
          <p className="mt-1 text-sm text-ink-2">
            {editable
              ? "Change the points per kilometre, the climbing rate, or the weekly quota. New rates count from today forward — weeks already ridden keep the points they were ridden for."
              : "These are the league rules. Ryan sets them."}
          </p>
          {upcoming.length > 0 && (
            <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
              <p className="eyebrow text-ink">Already scheduled</p>
              <ul className="mt-1.5 space-y-1">
                {upcoming.map((change) => (
                  <li key={change.from} className="text-[0.8125rem] text-ink-2">
                    <span className="font-semibold text-ink">
                      From {formatDay(change.from)}
                    </span>
                    {" — "}
                    {SPORT_ORDER.filter(
                      (sport) =>
                        change.multipliers?.[sport] !== undefined ||
                        change.elevationPer100m?.[sport] !== undefined,
                    )
                      .map((sport) => {
                        const bits: string[] = [];
                        const m = change.multipliers?.[sport];
                        if (m !== undefined) {
                          bits.push(`${m} pts/${UNIT_ABBR[SPORT_UNIT[sport]]}`);
                        }
                        const e = change.elevationPer100m?.[sport];
                        if (e !== undefined) bits.push(`${e}/100m`);
                        return `${SPORT_UI[sport].label.toLowerCase()} ${bits.join(" + ")}`;
                      })
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {SPORT_ORDER.map((sport) => {
            const ui = SPORT_UI[sport];
            return (
              <div
                key={sport}
                className="flex items-center gap-3 rounded-xl pane border border-line bg-tile px-4 py-3"
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
                  className={`stamp w-20 rounded-lg border px-2 py-1.5 text-right text-xl text-ink focus:outline-none ${
                    editable ? "border-ink bg-tile" : "border-transparent bg-transparent"
                  }`}
                />
                <span className="eyebrow w-12 text-ink-3">pts/{UNIT_ABBR[SPORT_UNIT[sport]]}</span>
              </div>
            );
          })}

          {/* Open water is a different RATE for the same sport rather than a
              second quantity, so it sits with the disciplines and not with
              climbing. */}
          <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
            <p className="eyebrow text-ink">Open water</p>
            <p className="mt-1 text-[0.8125rem] text-ink-2">
              A swim in a lake, river or sea — no wall, no line, and you have to
              sight.{" "}
              <span className="text-ink-3">
                Unlike the rates above, this one applies to every swim ever
                logged, not only from today.
              </span>
            </p>
            <div className="mt-2 flex items-center gap-3">
              <label htmlFor="openwater" className="eyebrow flex-1 text-ink-2">
                Per km
              </label>
              <input
                id="openwater"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={form.openWater}
                disabled={!editable || busy}
                onChange={(e) => setForm({ ...form, openWater: e.target.value })}
                className="w-20 rounded-lg border-2 border-ink-3 bg-tile px-2 py-2 text-right text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-60"
              />
              <span className="eyebrow w-12 text-ink-3">pts/km</span>
            </div>
          </div>

          {/* Climbing is a second rate against a different quantity, so it gets
              its own group rather than a cramped second box per row. Gym is
              left out: a workout has no ascent. */}
          <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
            <p className="eyebrow text-ink">Climbing</p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-2">
              Points per 100 m of ascent, on top of the distance. Set 0 to switch
              a discipline off. Only sessions with a known ascent earn it.
            </p>
            <div className="mt-3 space-y-2">
              {SPORT_ORDER.filter((sport) => SPORT_UNIT[sport] !== "flat").map((sport) => {
                const ui = SPORT_UI[sport];
                const key = CLIMB_KEY[sport];
                return (
                  <div key={sport} className="flex items-center gap-3">
                    <span className={ui.text}>
                      <SportMark sport={sport} className="h-4 w-4" />
                    </span>
                    <label htmlFor={`climb-${sport}`} className="eyebrow flex-1 text-ink-2">
                      {ui.label}
                    </label>
                    <input
                      id={`climb-${sport}`}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      readOnly={!editable}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className={`stamp w-20 rounded-lg border px-2 py-1.5 text-right text-lg text-ink focus:outline-none ${
                        editable ? "border-ink bg-tile" : "border-transparent bg-transparent"
                      }`}
                    />
                    <span className="eyebrow w-12 text-ink-3">/100m</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-deck-2/50 px-4 py-3">
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
              className={`stamp w-20 rounded-lg border px-2 py-1.5 text-right text-xl text-ink focus:outline-none ${
                editable ? "border-ink bg-tile" : "border-transparent bg-transparent"
              }`}
            />
            <span className="eyebrow w-12 text-ink-3">pts</span>
          </div>

          <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
            <label htmlFor="season" className="eyebrow block text-ink-2">
              Kickoff date
            </label>
            <input
              id="season"
              type="date"
              readOnly={!editable}
              value={form.seasonStart}
              onChange={(e) => setForm({ ...form, seasonStart: e.target.value })}
              className={`mt-2 block w-full appearance-none rounded-lg border px-3 py-2 text-ink [color-scheme:light] focus:outline-none ${
                editable ? "border-ink-3 bg-tile focus:border-accent" : "border-transparent bg-transparent"
              }`}
            />
            <p className="mt-1.5 text-[0.6875rem] text-ink-3">
              Shown on the sign-in screen. Logging counts from day one.
            </p>
          </div>

          <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
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
              className={`mt-2 block w-full rounded-lg border px-3 py-2 text-ink focus:outline-none ${
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
            className="eyebrow mt-3 w-full rounded-xl pane border border-line bg-tile px-4 py-3 text-ink-2"
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
    <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
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
          className="eyebrow flex-1 rounded-lg pane border border-line bg-tile px-3 py-2.5 text-ink-2 transition-transform active:scale-95 disabled:opacity-40"
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
                className={`h-9 w-full rounded-lg border transition-transform active:scale-95 disabled:opacity-40 ${
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

/**
 * Change your name, once a league day. Ryan, 2026-10-06.
 *
 * A button, not save-on-blur like the weight beside it: a rename spends the
 * day's one change, and tapping out of the box by accident shouldn't. The
 * server owns every rule (lib/rename, /api/session PATCH) — this just says
 * what it said back.
 */
function NameField({ league }: { league: League }) {
  const { state, send, busy } = league;
  const current = state.me?.name ?? "";
  const [draft, setDraft] = useState(current);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const admin = state.isAdmin;
  const changed = draft.trim() !== "" && draft.trim() !== current;

  async function save() {
    const err = await send("/api/session", { method: "PATCH", body: JSON.stringify({ name: draft.trim() }) });
    setNote(err ? { ok: false, text: err } : { ok: true, text: `Done. Sign in as ${draft.trim()} from now on.` });
  }

  return (
    <div className="mt-4 rounded-xl pane border border-line bg-tile px-4 py-3">
      <label htmlFor="rename" className="eyebrow block text-ink">Your name</label>
      <p className="mt-0.5 text-[0.8125rem] text-ink-2">
        {admin
          ? "The admin is whoever's called Ryan, so yours stays."
          : "Once a day. It's also how you sign in, so use the new one next time."}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="rename"
          value={draft}
          maxLength={40}
          disabled={busy || admin}
          onChange={(e) => { setDraft(e.target.value); setNote(null); }}
          className="min-w-0 flex-1 rounded-lg pane border border-line-2 bg-tile px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || admin || !changed}
          className="eyebrow shrink-0 rounded-lg border border-line-2 px-3 py-2 text-ink disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {note && (
        <p className={`mt-2 text-[0.8125rem] ${note.ok ? "text-mint" : "text-magenta"}`}>{note.text}</p>
      )}
    </div>
  );
}
