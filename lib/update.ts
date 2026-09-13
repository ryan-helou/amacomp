/**
 * Whether the page should reload itself to pick up a newer build.
 *
 * Pure on purpose, so the rules that stop it misbehaving are testable without a
 * browser: reloading while someone is typing would throw away what they typed,
 * and reloading again for a build we already reloaded for — a CDN still serving
 * the old page for a minute — would loop.
 */
export function shouldReload({
  clientBuild,
  serverBuild,
  lastReloadedFor,
  editing,
}: {
  /** The build this page was loaded from. */
  clientBuild: string | undefined;
  /** What the server says it is running, or null if we couldn't ask. */
  serverBuild: string | null;
  /** The server build we last reloaded to reach, if any, this session. */
  lastReloadedFor: string | null;
  /** Someone is mid-entry: a focused field, or a form with unsaved input. */
  editing: boolean;
}): boolean {
  if (!clientBuild || !serverBuild) return false; // dev, or offline — nothing to compare
  if (serverBuild === clientBuild) return false; // already current
  if (editing) return false; // never throw away what they are typing; try again later
  if (lastReloadedFor === serverBuild) return false; // we already tried for this one
  return true;
}
