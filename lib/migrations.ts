import type { Settings } from "./types";

/**
 * One-off changes to the settings row, applied when the store starts.
 *
 * Each one checks whether it has already happened and does nothing if so, so
 * a deploy applies it exactly once and every later start is a no-op. Written
 * as code rather than run by hand against the database, so the change is in
 * git with its reason, and a local or QA server gets it too.
 */
export function migrateSettings(settings: Settings): Settings | null {
  let next: Settings | null = null;
  for (const m of MIGRATIONS) {
    const out = m(next ?? settings);
    if (out) next = out;
  }
  return next;
}

const MIGRATIONS: ((s: Settings) => Settings | null)[] = [
  /**
   * Bike climbing: one point every 33 m, for every ride ever logged.
   *
   * Ryan, 2026-10-10: "Fix cycling to 33 and make an announcement and all past
   * data." Was 1 point per 100 m. His league's own rides put 100 m of climbing
   * at about 3.5 flat kilometres of time, so the old rate paid a hilly hour
   * well under a flat one. Retroactive by instruction, so it goes into the BASE
   * rate (no dated change touches bike climbing) and is recorded in
   * retroChanges so the app announces it with the right words. Checked before
   * shipping: no past week's winner, quota or forfeit changes, and the Season 1
   * order stays the same.
   */
  (s) => {
    const done = (s.retroChanges ?? []).some(
      (c) => c.on === "2026-10-10" && c.sport === "bike" && c.climb,
    );
    if (done) return null;
    const before = s.elevationPer100m.bike;
    const after = 100 / 33;
    return {
      ...s,
      elevationPer100m: { ...s.elevationPer100m, bike: after },
      retroChanges: [
        ...(s.retroChanges ?? []),
        { on: "2026-10-10", sport: "bike", climb: true, before, after },
      ],
    };
  },
];
