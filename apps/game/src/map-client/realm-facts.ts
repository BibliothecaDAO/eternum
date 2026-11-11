import {
  buildableRadius,
  configManager,
  DEFAULT_COORD_ALT,
  getStructureStage,
  isExpeditionRealm,
  storedBiomeAt,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { BiomeType, BUILDINGS_CENTER, BuildingType, StructureType } from "@bibliothecadao/types";

import { getGameModeConfig } from "@/config/game-modes";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { BUILDINGS_GROUPS } from "@/three/constants";
import { resolveBuildingModelSelection } from "@/three/scenes/hexception-building-model";
import { getLocalHexDisk, getLocalTerrainRegions, resolveLocalHexOnMap } from "@/three/scenes/hexception-terrain";
import { pickLocalRealm } from "@/three/scenes/local-realm";
import { readRealmSkin } from "@/three/structures/realm-skins";
import { hashCoordinates } from "@/three/utils/hex-hash";

import type { Hex } from "./land-from-facts";

/** How far round its keep a realm's view draws ground, in hexes, as today's realm view does. */
const REALM_REACH = 4;
const KEEP: Hex = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };

/** A hex of a realm's own lattice, with the ground the map has under it. */
export interface RealmCell extends Hex {
  biome: BiomeType;
  /** Whether a building may stand on it at the realm's level. */
  plot: boolean;
}

/** A building on its plot, with the model it is drawn as and the turn its plot gives it. */
export interface RealmBuilding extends Hex {
  category: string;
  path: string;
  turn: number;
}

/** A realm as its view draws it: its plots, the ground round them, and what is built. */
export interface RealmLand {
  realmId: number;
  /** Where the realm stands on the map today, as contracts count it. */
  site: Hex;
  cells: RealmCell[];
  buildings: RealmBuilding[];
}

/**
 * The realm an address names, read from the game's facts by today's rules: the structure on the route's hex, or the
 * realm picked where a Frontier realm has moved since the address was written (`pickLocalRealm`). Null while no
 * structure answers, or its expedition has not started.
 */
export function readRealm(
  store: NativeFactStore,
  projection: WorldSpatialProjection,
  route: Hex | null,
): RealmLand | null {
  const game = configManager.getActiveGameId();
  const standing =
    route &&
    projection
      .getStructuresAtHex({ alt: DEFAULT_COORD_ALT, ...route })
      .find((entry) => entry.entityId !== null && !entry.clearedSite);
  const structure = pickLocalRealm({
    atRoute: standing?.entityId ? store.get("Structure", { game_id: game, entity_id: standing.entityId }) : undefined,
    selected: store.get("Structure", { game_id: game, entity_id: useUIStore.getState().structureEntityId }),
    followsTheDay: (candidate) => isExpeditionRealm(store, candidate),
  });
  const site = structure && structureMapPosition(store, structure);
  if (!structure || !site) return null;
  const realmId = safeInteger(structure.entity_id);
  const tiles = requireActiveGameClient().views.buildingTiles(realmId);
  const type = tiles.structureType();
  const stage =
    type === StructureType.Hyperstructure ? getStructureStage(type, realmId, store) : tiles.getRealmLevel(realmId);
  const mapSite = { col: site.x, row: site.y };
  const plots = new Set(getLocalHexDisk(KEEP, buildableRadius(stage)).map(keyOf));

  const biomeAt = (hex: Hex) =>
    storedBiomeAt(store, false, hex.col, hex.row) ??
    storedBiomeAt(store, false, mapSite.col, mapSite.row) ??
    BiomeType.Grassland;
  const cells = getLocalTerrainRegions(tiles.getHexCoords(), REALM_REACH).flatMap(({ center, targetHex }) => {
    const biome = biomeAt(resolveLocalHexOnMap(tiles.getHexCoords(), targetHex, mapSite));
    return getLocalHexDisk({ col: center[0] + KEEP.col, row: center[1] + KEEP.row }, REALM_REACH).map(
      ({ col, row }) => ({ col, row, biome, plot: plots.has(keyOf({ col, row })) }),
    );
  });

  const built = [...tiles.existingBuildings(), ...keepOf(type)];
  const paths = getGameModeConfig().assets.buildingModelPaths;
  const buildings = built.flatMap((building) => {
    const selection = resolveBuildingModelSelection(building, {
      stage,
      structureId: realmId,
      mainStructureType: type,
      wonder: !!tiles.getWonder(realmId),
      frontier: getGameModeConfig().id === "frontier",
      realmSkin:
        type === StructureType.Realm ? readRealmSkin(store, { game_id: game, entity_id: BigInt(realmId) }) : undefined,
    });
    // A hyperstructure builds its own model in code, which this map does not draw yet.
    if (selection.group === BUILDINGS_GROUPS.HYPERSTRUCTURE) return [];
    const groupPaths: Readonly<Record<string, string>> = paths[selection.group];
    const path = selection.tierPath ?? groupPaths[selection.type];
    const turn = (Math.floor(hashCoordinates(building.col, building.row) * 6) * Math.PI) / 3;
    return path ? [{ col: building.col, row: building.row, category: String(building.category), path, turn }] : [];
  });
  return { realmId, site: mapSite, cells, buildings };
}

/**
 * The keep of a camp, which holds no building fact for it as a realm and a village do. No other structure's board
 * draws a keep today.
 */
function keepOf(type: StructureType) {
  if (type !== StructureType.Camp) return [];
  return [{ ...KEEP, category: BuildingType.ResourceLabor, structureType: type, resource: undefined, tier: undefined }];
}

const keyOf = (hex: Hex): string => `${hex.col},${hex.row}`;
