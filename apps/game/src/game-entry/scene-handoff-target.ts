import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import type { Position } from "@bibliothecadao/eternum";

interface HandoffFacts {
  entryMode: "player" | "spectator";
  structureEntityId: number;
  isSpectating: boolean;
  /** The selection's map hex, normalized, when the selection named where it stands. */
  returnPosition: { col: number; row: number } | null;
  /**
   * The entry's answer for the realm it opens (entry-destination): undefined until it has answered, null when it has
   * none to open.
   */
  destination: Position | null | undefined;
}

/** What a map-first entry does once the map converged: open the realm, stay on the map, or wait for the realm. */
type HexHandoff = { kind: "open"; hex: { col: number; row: number } } | { kind: "stay-on-map" } | { kind: "wait" };

/**
 * The realm a map-first entry hands off to. A player's is their own selected structure, never the spectator fallback
 * chosen before their realm arrived; a spectator's is the one they watch. With nothing to open (a player who owns no
 * structure yet, a game with none) the entry stays on the map. The map can converge before the entry's realm arrives
 * (a Frontier realm streams in its subject's scope after the snapshot), so the hand-off waits for the entry's answer
 * rather than reading an empty board as none.
 */
export const resolveHexHandoff = ({
  entryMode,
  structureEntityId,
  isSpectating,
  returnPosition,
  destination,
}: HandoffFacts): HexHandoff => {
  if (destination === undefined) return { kind: "wait" };
  if (destination === null) return { kind: "stay-on-map" };
  if (structureEntityId === UNDEFINED_STRUCTURE_ENTITY_ID || returnPosition === null) return { kind: "wait" };
  if (entryMode === "player" && isSpectating) return { kind: "wait" };
  return { kind: "open", hex: returnPosition };
};
