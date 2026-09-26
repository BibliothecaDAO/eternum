import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";

interface HandoffSelection {
  entryMode: "player" | "spectator";
  structureEntityId: number;
  isSpectating: boolean;
  /** The selection's map hex, normalized, when the selection named where it stands. */
  returnPosition: { col: number; row: number } | null;
}

/**
 * The hex a map-first entry hands off to: the realm the local view opens, once it is known. A player's is their own
 * selected structure, never the spectator fallback chosen before their realm arrived; a spectator's is the one they
 * watch. Until then there is no handoff, so the local view is never entered on a hex with no realm to open.
 */
export const resolveHexHandoffTarget = ({
  entryMode,
  structureEntityId,
  isSpectating,
  returnPosition,
}: HandoffSelection): { col: number; row: number } | null => {
  if (structureEntityId === UNDEFINED_STRUCTURE_ENTITY_ID || returnPosition === null) return null;
  if (entryMode === "player" && isSpectating) return null;
  return returnPosition;
};
