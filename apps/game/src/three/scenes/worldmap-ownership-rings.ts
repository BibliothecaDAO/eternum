import { accountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { publishMapSelection } from "@/observability/map-selection";
import { activeMapLayer } from "@/three/map-layer";
import { isWithinWorldOriginReach, subscribeWorldOrigin } from "@/three/world-origin";
import { configManager, Position } from "@bibliothecadao/eternum";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
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
  rings: { show(hexes: readonly HexPosition[]): void; ringed(): number };
}

/**
 * Selecting a hex that holds a player's structure rings every hex that player holds, the viewer's own or anyone's.
 * The rings read only the selected hex and the facts: every selection or clear, from any surface, moves them, and they
 * follow the layer shown, the floating origin, ownership (a capture hands them to the new owner) and every structure
 * or army the projection moves, adds or removes, so they always match the facts the map draws. Each redraw publishes the selection and what
 * the layer rings (observability/map-selection).
 */
export function bindOwnershipRings({ store, projection, rings }: OwnershipRingsInput): () => void {
  const redraw = () => {
    const sources = { store, projection, gameId: configManager.getActiveGameId() };
    const selected = useUIStore.getState().selectedHex;
    const alt = activeMapLayer();
    const owned = selected ? structureAt(sources, { alt, ...selected }) : null;
    rings.show(hexesHeldByOwnerOf(sources, owned, alt).map(toSceneHex).filter(isWithinWorldOriginReach));
    publishMapSelection({
      hex: selected ? { col: selected.col, row: selected.row } : null,
      structure: describeStructure(sources, owned),
      ringedHexes: rings.ringed(),
    });
  };
  const stops = [
    useUIStore.subscribe((state) => state.selectedHex, redraw),
    useUIStore.subscribe((state) => state.mapLayer, redraw),
    subscribeWorldOrigin(redraw),
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

/** The selected structure as the selection mirror names it: its owner, whether it is a realm and the viewer's. */
function describeStructure({ store, gameId }: OwnershipSources, structureId: ID | null) {
  const structure =
    structureId === null ? undefined : store.get("Structure", { game_id: gameId, entity_id: structureId });
  if (!structure || structureId === null) return null;
  const viewer = accountAddress();
  return {
    id: safeInteger(structureId),
    owner: `0x${BigInt(structure.owner).toString(16)}`,
    realm: isRealmCategory(structure.base.category),
    ownedByViewer: viewer !== null && BigInt(structure.owner) === viewer,
  };
}

/** The structure standing on a hex; null on an empty hex or a reserved construction site. */
function structureAt({ projection }: OwnershipSources, hex: WorldSpatialHex): ID | null {
  return (
    projection.getStructuresAtHex(hex).find((candidate) => !candidate.reserved && !candidate.clearedSite)?.entityId ??
    null
  );
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
