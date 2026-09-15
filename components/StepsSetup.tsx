"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/dates";
import { STEPS_SHORTCUT_NAME, STEPS_SHORTCUT_URL } from "@/lib/steps";
import type { League } from "./useLeague";

/**
 * Connecting a phone's steps.
 *
 * Steps come from Apple Health through a free iOS Shortcut (lib/steps.ts). This
 * panel does the three things the athlete can't do inside the Shortcuts app:
 * install it, hand it their personal code, and remember the automation.
 *
 * Most athletes have a personal shortcut made for them, their code already
 * inside (scripts/make-step-shortcuts.mjs): then it's add it, run it once, and
 * make the automation. Without one, the code is issued here instead.
 *
 * The code is issued on a tap and then handed over on a SECOND tap. iOS only
 * lets a page open another app from a direct tap, and the fetch in between
 * would cost the first tap that permission.
 */
export function StepsSetup({ league }: { league: League }) {
  const link = league.state.stepsLink;
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/steps/token", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!res.ok || !body?.token) setMsg(body?.error ?? "Couldn't make a code. Try again.");
      else setCode(body.token);
    } catch {
      setMsg("No connection. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMsg("Code copied.");
    } catch {
      setMsg("Couldn't copy — select the code and copy it by hand.");
    }
  }

  const openShortcut = code
    ? `shortcuts://run-shortcut?name=${encodeURIComponent(STEPS_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(code)}`
    : null;

  const personal = link.shortcutKey && !code;
  const runOnce = `shortcuts://run-shortcut?name=${encodeURIComponent(STEPS_SHORTCUT_NAME)}`;

  const status = !link.connected
    ? "Your watch's steps, from Apple Health, on a free Shortcut. No app to install."
    : link.lastSyncAtISO
      ? `Steps are coming in. Last report ${timeAgo(link.lastSyncAtISO) === "just now" ? "just now" : `${timeAgo(link.lastSyncAtISO)} ago`}.`
      : "Connected — waiting for your phone's first report.";

  return (
    <div className="rounded-xl pane border border-line bg-tile px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow text-ink">Steps</div>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">{status}</p>
        </div>
        {link.connected && !code && (
          <span className="eyebrow shrink-0 rounded-md bg-deck-2 px-2 py-1 text-ink-2">Linked</span>
        )}
      </div>

      <ol className="mt-3 space-y-2.5 border-t border-line pt-3 text-[0.8125rem] text-ink-2">
        {personal ? (
          <>
            <li>
              <span className="font-semibold text-ink">1. Add your shortcut.</span> It&rsquo;s made for
              you — your code is already inside.
              {/* A new tab, so it opens in Safari: Safari is what hands a
                  .shortcut file to the Shortcuts app. */}
              <a
                href={`/api/steps/shortcut/${link.shortcutKey}`}
                target="_blank"
                rel="noreferrer"
                className="eyebrow mt-1.5 block w-full rounded-lg bg-ink px-3 py-2.5 text-center text-on-ink"
              >
                Add “{STEPS_SHORTCUT_NAME}”
              </a>
              <span className="mt-1 block text-xs text-ink-3">
                Tap Download if asked, open it, then Add Shortcut.
              </span>
            </li>
            <li>
              <span className="font-semibold text-ink">2. Run it once.</span>
              <a
                href={runOnce}
                className="eyebrow mt-1.5 block w-full rounded-lg border border-line px-3 py-2.5 text-center text-ink"
              >
                Run it
              </a>
              <span className="mt-1 block text-xs text-ink-3">
                Allow Health when it asks. If it says Shortcuts doesn&rsquo;t have access to your Steps:
                Settings app → Privacy &amp; Security → Health → Shortcuts → turn on Steps, then run it
                again. You&rsquo;ll get a &ldquo;Connected&rdquo; notification.
              </span>
            </li>
          </>
        ) : (
          <>
            <li>
              <span className="font-semibold text-ink">1. Install the shortcut.</span>{" "}
              {STEPS_SHORTCUT_URL ? (
                <a href={STEPS_SHORTCUT_URL} className="font-semibold text-ink underline underline-offset-2">
                  Get “{STEPS_SHORTCUT_NAME}”
                </a>
              ) : (
                <span>The link is on its way — Ryan is setting it up.</span>
              )}
            </li>
            <li>
              <span className="font-semibold text-ink">2. Connect this phone.</span>
              {!code ? (
                <button
                  onClick={issue}
                  disabled={busy}
                  className="eyebrow mt-1.5 block w-full rounded-lg bg-ink px-3 py-2.5 text-on-ink disabled:opacity-40"
                >
                  {busy ? "One sec…" : link.connected ? "Reconnect this phone" : "Get my code"}
                </button>
              ) : (
                <div className="mt-1.5 space-y-2">
                  <a
                    href={openShortcut ?? "#"}
                    className="eyebrow block w-full rounded-lg bg-ink px-3 py-2.5 text-center text-on-ink"
                  >
                    Open the shortcut
                  </a>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-deck-2 px-2 py-1.5 font-mono text-xs text-ink">
                      {code}
                    </code>
                    <button onClick={copy} className="eyebrow shrink-0 rounded-md border border-line px-2 py-1.5 text-ink-2">
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-ink-3">
                    This code is shown once. Getting a new one replaces it.
                  </p>
                </div>
              )}
            </li>
          </>
        )}

        <li>
          <span className="font-semibold text-ink">3. Make it automatic.</span> In Shortcuts,
          open Automation → + → App. Pick apps you open all day (Messages, Instagram,
          WhatsApp), choose <em>Is Opened</em>, then <em>Run Immediately</em> with{" "}
          <em>Notify When Run</em> off, and pick “{STEPS_SHORTCUT_NAME}”.
        </li>

        <li>
          <span className="font-semibold text-ink">4. Stop double counting.</span>{" "}
          In the Health app, open Steps → Data Sources &amp; Access and drag your watch above
          your iPhone.
        </li>
      </ol>

      {msg && <p className="mt-2 text-xs font-medium text-ink-3">{msg}</p>}
    </div>
  );
}
