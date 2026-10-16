import type { HexPosition, ID } from "@bibliothecadao/types";

/**
 * What the player selected on the map: the one selection the map, its HUDs and the scene read. An army or a structure
 * is selected by identity, so the tile it stands on is always where it is now; a plain hex is a tile of terrain.
 *
 * An army names the tile it shows: its own ("own", following it), a tile it acts on (an attack's target card), or none
 * (selected from a HUD surface that opens no tile card).
 */
export type MapSelectionIntent =
  | { kind: "army"; entityId: ID; tile: "own" | HexPosition | null }
  | { kind: "structure"; entityId: ID }
  | { kind: "hex"; hex: HexPosition }
  | null;

/** Where an army or a structure stands now, in contract coordinates with its layer; undefined while it is unknown. */
export interface MapSelectionPositions {
  army: (entityId: ID) => { col: number; row: number; alt: boolean } | undefined;
  structure: (entityId: ID) => { col: number; row: number; alt: boolean } | undefined;
}

/** What the selection shows: the selected entity, and the contract hex every tile panel, ring and card names. */
export interface DerivedMapSelection {
  selectedEntityId: ID | null;
  selectedHex: HexPosition | null;
}

let positions: MapSelectionPositions | null = null;

/** The map lends the positions its projection holds; the returned function takes them back. */
export function attachMapSelectionPositions(source: MapSelectionPositions): () => void {
  positions = source;
  return () => {
    if (positions === source) positions = null;
  };
}

/**
 * The selection as shown on `layer`: an entity's hex is where it stands now, and nothing while it stands elsewhere,
 * on the other layer or nowhere the map knows (not yet attached, removed, rolled back).
 */
export function deriveMapSelection(intent: MapSelectionIntent, layer: boolean): DerivedMapSelection {
  if (!intent) return { selectedEntityId: null, selectedHex: null };
  if (intent.kind === "hex") return { selectedEntityId: null, selectedHex: intent.hex };
  if (intent.kind === "army" && intent.tile !== "own")
    return { selectedEntityId: intent.entityId, selectedHex: intent.tile };
  const at = positions?.[intent.kind](intent.entityId);
  return {
    selectedEntityId: intent.entityId,
    selectedHex: at && at.alt === layer ? { col: at.col, row: at.row } : null,
  };
}

/** The intent with its tile card closed: a tile or structure is deselected, an army stays selected with no tile. */
export function withoutSelectedTile(intent: MapSelectionIntent): MapSelectionIntent {
  if (!intent || intent.kind !== "army") return null;
  return intent.tile === null ? intent : { ...intent, tile: null };
}
