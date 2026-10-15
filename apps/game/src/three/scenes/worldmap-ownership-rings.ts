import { useUIStore } from "@/hooks/store/use-ui-store";
import { activeMapLayer } from "@/three/map-layer";
import { isWithinWorldOriginReach } from "@/three/world-origin";
import { configManager, Position } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialHex, WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import type { HexPosition, ID } from "@bibliothecadao/types";

/** Where ownership and positions are read: the native fact store and the projection the map draws from. */
interface OwnershipSources {
  store: Pick<NativeFactStore, "get" | "structuresOwnedBy" | "armiesAtHome">;
  projection: Pick<WorldSpatialProjection, "getStructure" | "getArmy" | "getStructuresAtHex">;
  gameId: number;
}

interface OwnershipRingsInput {
  store: OwnershipSources["store"] & Pick<NativeFactStore, "subscribe">;
  projection: OwnershipSources["projection"] & Pick<WorldSpatialProjection, "subscribe">;
  rings: { show(hexes: readonly HexPosition[]): void };
}

/**
 * Selecting a hex that holds a player's structure rings every hex that player holds, the viewer's own or anyone's.
 * The selection names the structure on the hex when it is made; from then on the rings follow that structure's owner
 * and holdings, so a Frontier realm whose daily site moves keeps its owner's rings, and a capture hands the rings to
 * the structure's new owner. The rings follow the layer shown and every structure or army the projection moves, adds
 * or removes, so they always match the facts the map draws.
 */
export function bindOwnershipRings({ store, projection, rings }: OwnershipRingsInput): () => void {
  const sources = (): OwnershipSources => ({ store, projection, gameId: configManager.getActiveGameId() });
  let selectedStructure: ID | null = null;
  const redraw = () => {
    const held = hexesHeldByOwnerOf(sources(), selectedStructure, activeMapLayer());
    rings.show(held.map(toSceneHex).filter(isWithinWorldOriginReach));
  };
  const select = () => {
    const selected = useUIStore.getState().selectedHex;
    selectedStructure = selected ? structureAt(sources(), { alt: activeMapLayer(), ...selected }) : null;
    redraw();
  };
  const stops = [
    useUIStore.subscribe((state) => state.selectedHex, select),
    useUIStore.subscribe((state) => state.mapLayer, select),
    store.subscribe((changes) => {
      if (changes.some((change) => change.model === "Structure")) redraw();
    }),
    projection.subscribe((changes) => {
      if (changes.some((change) => change.kind === "structure" || change.kind === "army")) redraw();
    }),
  ];
  select();
  return () => stops.forEach((stop) => stop());
}

/** The structure standing on a hex; null on an empty hex or a reserved construction site. */
function structureAt({ projection }: OwnershipSources, hex: WorldSpatialHex): ID | null {
  return projection.getStructuresAtHex(hex).find((candidate) => !candidate.reserved)?.entityId ?? null;
}

/**
 * Every hex on one layer where the structure's current owner holds a structure or has an army out from one, where the
 * map draws it; none for no structure or one no player owns.
 */
function hexesHeldByOwnerOf(sources: OwnershipSources, structureId: ID | null, alt: boolean): WorldSpatialHex[] {
  const { store, projection, gameId } = sources;
  if (structureId === null) return [];
  const owner = store.get("Structure", { game_id: gameId, entity_id: structureId })?.owner;
  if (!owner) return [];
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

function toSceneHex({ col, row }: WorldSpatialHex): HexPosition {
  const normalized = Position.fromContract({ x: col, y: row }).getNormalized();
  return { col: normalized.x, row: normalized.y };
}
