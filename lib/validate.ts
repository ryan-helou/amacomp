export const MAX_KM = 1000;
export const MAX_NOTE = 140;

export function parseKm(value: unknown): number | null {
  const km = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(km) || km <= 0 || km > MAX_KM) return null;
  return Math.round(km * 1000) / 1000; // metre precision is plenty
}

export function parseNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().slice(0, MAX_NOTE);
  return note || null;
}
