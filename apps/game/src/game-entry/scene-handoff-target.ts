import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";

interface HandoffFacts {
  entryMode: "player" | "spectator";
  structureEntityId: number;
  isSpectating: boolean;
  /** The selection's map hex, normalized, when the selection named where it stands. */
  returnPosition: { col: number; row: number } | null;
  /** The structures the entry could open: the player's own, or every structure in the game for a spectator. */
  openableStructures: number;
}

/** What a map-first entry does once the map converged: open the realm, stay on the map, or wait for the realm. */
type HexHandoff = { kind: "open"; hex: { col: number; row: number } } | { kind: "stay-on-map" } | { kind: "wait" };

/**
 * The realm a map-first entry hands off to. A player's is their own selected structure, never the spectator fallback
 * chosen before their realm arrived; a spectator's is the one they watch. With nothing to open (a player who owns no
 * structure yet, a game with none) the entry stays on the map. The map converges only after the game's state has
 * synced, so a count of zero means none, not "not loaded".
 */
export const resolveHexHandoff = ({
  entryMode,
  structureEntityId,
  isSpectating,
  returnPosition,
  openableStructures,
}: HandoffFacts): HexHandoff => {
  if (openableStructures === 0) return { kind: "stay-on-map" };
  if (structureEntityId === UNDEFINED_STRUCTURE_ENTITY_ID || returnPosition === null) return { kind: "wait" };
  if (entryMode === "player" && isSpectating) return { kind: "wait" };
  return { kind: "open", hex: returnPosition };
};
