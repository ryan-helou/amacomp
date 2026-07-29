"use client";

import { useEffect, useState } from "react";

type State =
  | "checking"
  | "unsupported"
  | "need-standalone"
  | "off"
  | "on"
  | "denied"
  | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function NotificationSetup() {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        // iOS only exposes Push once the app is on the home screen.
        setState(isStandalone() ? "unsupported" : "need-standalone");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey, enabled } = await fetch("/api/push/vapid").then((r) => r.json());
      if (!enabled || !publicKey) {
        setError("Notifications aren't switched on server-side yet.");
        setState("off");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setError("Couldn't turn on notifications. Try again.");
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } catch {
      /* ignore */
    }
    setState("off");
  }

  async function sendTest() {
    setError(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    if (res.ok) {
      setTested(true);
      setTimeout(() => setTested(false), 3000);
    } else {
      setError("Test failed — is a notification blocked?");
    }
  }

  return (
    <div className="rounded-xl border-2 border-line bg-tile px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow text-ink">Notifications</div>
          <p className="mt-0.5 text-[0.8125rem] text-ink-2">{blurb(state)}</p>
        </div>
        {state === "off" && (
          <button
            onClick={enable}
            className="accent-fill eyebrow shrink-0 rounded-lg px-3 py-2 shadow-sm"
          >
            Enable
          </button>
        )}
        {state === "on" && (
          <span className="eyebrow shrink-0 rounded-md bg-good/12 px-2 py-1 text-good">On</span>
        )}
        {state === "working" && (
          <span className="eyebrow shrink-0 text-ink-3">…</span>
        )}
      </div>

      {state === "on" && (
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <button
            onClick={sendTest}
            className="eyebrow flex-1 rounded-lg border-2 border-line px-3 py-2 text-ink-2"
          >
            {tested ? "Sent ✓" : "Send test"}
          </button>
          <button
            onClick={disable}
            className="eyebrow rounded-lg px-3 py-2 text-ink-3"
          >
            Turn off
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-run">{error}</p>}
    </div>
  );
}

function blurb(state: State): string {
  switch (state) {
    case "checking":
      return "…";
    case "unsupported":
      return "This browser doesn't support push notifications.";
    case "need-standalone":
      return "Add AmaComp to your home screen first, then open it from there.";
    case "denied":
      return "Blocked. Turn notifications on for AmaComp in your device settings.";
    case "on":
      return "You'll get nudged when someone passes you and when the week wraps.";
    case "working":
      return "Setting up…";
    case "off":
    default:
      return "Get pinged when someone passes you, and when weekly results drop.";
  }
}
