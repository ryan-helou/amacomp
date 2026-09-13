"use client";

import { useEffect } from "react";
import { shouldReload } from "@/lib/update";

const CLIENT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID;
const STORAGE_KEY = "amacomp-reloaded-for";
const POLL_MS = 5 * 60_000;

/**
 * Reloads the page when a newer build is live.
 *
 * A home-screen app on iOS keeps its page in memory and restores it on reopen
 * without fetching anything, so a deploy was invisible until the athlete
 * force-quit. This asks the server which build it runs whenever the app comes
 * back to the foreground (and every few minutes while it's open), and reloads if
 * it isn't the build this page came from.
 *
 * It holds off while anyone is mid-entry — a focused field, or a form carrying
 * unsaved input (`data-unsaved`, set by ActivityForm) — and tries again on the
 * next check, so an update never costs anyone what they were typing.
 */
function isEditing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) {
    return true;
  }
  return document.querySelector("[data-unsaved]") !== null;
}

export function UpdateWatcher() {
  useEffect(() => {
    if (!CLIENT_BUILD || process.env.NODE_ENV !== "production") return;
    let checking = false;

    async function check() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const serverBuild = res.ok ? ((await res.json()).build as string | null) : null;
        let lastReloadedFor: string | null = null;
        try {
          lastReloadedFor = sessionStorage.getItem(STORAGE_KEY);
        } catch {
          /* storage blocked — the loop guard just can't help */
        }
        if (shouldReload({ clientBuild: CLIENT_BUILD, serverBuild, lastReloadedFor, editing: isEditing() })) {
          try {
            sessionStorage.setItem(STORAGE_KEY, serverBuild!);
          } catch {
            /* reload anyway */
          }
          window.location.reload();
        }
      } catch {
        /* offline or the server is mid-deploy — the next check will try again */
      } finally {
        checking = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    // `pageshow` covers iOS restoring the page from its back/forward cache,
    // which does not always raise a visibility change.
    const onPageShow = () => void check();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
