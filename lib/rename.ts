import type { Settings } from "./types";

/**
 * Carry a man's name-keyed settings over to his new name.
 *
 * Ryan, 2026-10-06: names can change once a day. Almost everything in the app
 * hangs off an athlete's id, but the weekly-quota overrides do not —
 * `goalChanges` is keyed by NAME, which is how Jonah's 50-point week is
 * stored. Left alone, a rename would quietly put him back on 100 for every
 * week since September, and the recap would re-judge all of them. So the key
 * moves with him, in every dated change, and nothing else is touched.
 */
export function renameInSettings(settings: Settings, from: string, to: string): Settings {
  if (from === to || !settings.goalChanges?.length) return settings;
  return {
    ...settings,
    goalChanges: settings.goalChanges.map((change) => {
      if (!Object.prototype.hasOwnProperty.call(change.goals ?? {}, from)) return change;
      const goals = { ...change.goals };
      goals[to] = goals[from];
      delete goals[from];
      return { ...change, goals };
    }),
  };
}

/** Why a name can't be used, or null if it can. Same rules as signing up. */
export function nameProblem(name: string): string | null {
  if (!name) return "Enter your name to continue.";
  if (name.length > 40) return "Keep the name under 40 characters.";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’.-]*$/u.test(name)) {
    return "Names can use letters, numbers, spaces, apostrophes and hyphens.";
  }
  return null;
}
