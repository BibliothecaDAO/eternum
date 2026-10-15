import { useUIStore } from "@/hooks/store/use-ui-store";
import { activeMapLayer } from "@/three/map-layer";
import { isWithinWorldOriginReach } from "@/three/world-origin";
import { configManager, Position } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialHex, WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { HexPosition } from "@bibliothecadao/types";

/** Where ownership and positions are read: the native fact store and the projection the map draws from. */
export interface OwnershipSources {
  store: Pick<NativeFactStore, "get" | "structuresOwnedBy" | "armiesAtHome">;
  projection: Pick<WorldSpatialProjection, "getStructure" | "getArmy" | "getStructuresAtHex">;
  gameId: number;
}

interface OwnershipRingsInput {
  store: OwnershipSources["store"] & Pick<NativeFactStore, "subscribe">;
  projection: OwnershipSources["projection"] & Pick<WorldSpatialProjection, "subscribe">;
  rings: { show(hexes: readonly HexPosition[]): void };
}

/** The player who owns the structure on a hex; null where no player does. */
function ownerOfStructureAt({ store, projection, gameId }: OwnershipSources, hex: WorldSpatialHex) {
  const structure = projection.getStructuresAtHex(hex).find((candidate) => !candidate.reserved);
  if (!structure?.entityId) return null;
  const owner = store.get("Structure", { game_id: gameId, entity_id: structure.entityId })?.owner;
  return owner ? owner : null;
}

/** Every hex on one layer where `owner` holds a structure or has an army out from one, where the map draws it. */
function hexesHeldBy(sources: OwnershipSources, owner: bigint, alt: boolean): WorldSpatialHex[] {
  const { store, projection, gameId } = sources;
  const held = new Map<string, WorldSpatialHex>();
  const hold = (hex: WorldSpatialHex | undefined) => {
    if (hex?.alt === alt) held.set(`${hex.col}:${hex.row}`, hex);
  };
  for (const structure of store.structuresOwnedBy(gameId, owner)) {
    hold(projection.getStructure(safeInteger(structure.entity_id))?.hexCoords);
    for (const army of store.armiesAtHome(gameId, structure.entity_id))
      hold(projection.getArmy(safeInteger(army.explorer_id))?.hexCoords);
  }
  return [...held.values()];
}

/** The selected hex's owner's holdings on the layer shown; none when the selection holds no player's structure. */
export function hexesHeldBySelectedOwner(
  sources: OwnershipSources,
  selected: { col: number; row: number } | null,
  alt: boolean,
): WorldSpatialHex[] {
  const owner = selected ? ownerOfStructureAt(sources, { alt, ...selected }) : null;
  return owner === null ? [] : hexesHeldBy(sources, owner, alt);
}

/**
 * Selecting a hex that holds a player's structure rings every hex that player holds, the viewer's own or anyone's.
 * The rings follow the selection, the layer shown, ownership (a capture) and every structure or army the projection
 * moves, adds or removes, so they always match the facts the map draws.
 */
export function bindOwnershipRings({ store, projection, rings }: OwnershipRingsInput): () => void {
  const redraw = () => {
    const sources = { store, projection, gameId: configManager.getActiveGameId() };
    const held = hexesHeldBySelectedOwner(sources, useUIStore.getState().selectedHex, activeMapLayer());
    rings.show(held.map(toSceneHex).filter(isWithinWorldOriginReach));
  };
  const stops = [
    useUIStore.subscribe((state) => state.selectedHex, redraw),
    useUIStore.subscribe((state) => state.mapLayer, redraw),
    store.subscribe((changes) => {
      if (changes.some((change) => change.model === "Structure")) redraw();
    }),
    projection.subscribe((changes) => {
      if (changes.some((change) => change.kind === "structure" || change.kind === "army")) redraw();
    }),
  ];
  redraw();
  return () => stops.forEach((stop) => stop());
}

function toSceneHex({ col, row }: WorldSpatialHex): HexPosition {
  const normalized = Position.fromContract({ x: col, y: row }).getNormalized();
  return { col: normalized.x, row: normalized.y };
}
