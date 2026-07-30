import type { Comment, Reaction, ReactionType } from "./types";
import { REACTIONS } from "./types";
import type { GlyphName } from "@/components/Glyph";

export const REACTION_GLYPH: Record<ReactionType, GlyphName> = {
  fire: "flame",
  beast: "bolt",
  respect: "star",
};

export function reactionCounts(
  activityId: string,
  reactions: Reaction[],
): { counts: Record<ReactionType, number>; total: number } {
  const counts: Record<ReactionType, number> = { fire: 0, beast: 0, respect: 0 };
  let total = 0;
  for (const r of reactions) {
    if (r.activityId === activityId) {
      counts[r.type] += 1;
      total += 1;
    }
  }
  return { counts, total };
}

export function myReaction(
  activityId: string,
  meId: string | undefined,
  reactions: Reaction[],
): ReactionType | null {
  if (!meId) return null;
  return (
    reactions.find((r) => r.activityId === activityId && r.athleteId === meId)?.type ??
    null
  );
}

export function commentsFor(activityId: string, comments: Comment[]): Comment[] {
  return comments
    .filter((c) => c.activityId === activityId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const REACTION_ORDER = REACTIONS;
