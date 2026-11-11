import { configManager, FELT_CENTER, getExplorerOwner } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TileOccupier, TroopType } from "@bibliothecadao/types";
import { Color } from "three";

import { accountAddress } from "@/hooks/store/use-account-store";
import { mapSiteOf } from "@/config/map-sites";
import { ChestModelPath, SPIRE_MODEL_PATH } from "@/three/constants/scene-constants";
import { activeMapLayer } from "@/three/map-layer";
import { mapSiteModelPath } from "@/three/structures/map-site-models";
import { worldHexToWorld } from "@/three/world-origin";
import { SIDE_HEX } from "@/tokens";
import { arePlayersAllied, sideOf, watchedSide } from "@/utils/entity-ownership";

import type { MapArmy, TroopBuild } from "./army-marches";
import type { ExploredTile, Hex } from "./land-from-facts";
import type { MapLandmark, MapStructure } from "./scene-from-land";

/** Which of the renderer's builds each troop is drawn as. */
const BUILD_OF_TROOP: Record<TroopType, TroopBuild> = {
  [TroopType.Knight]: "knight",
  [TroopType.Crossbowman]: "crossbowman",
  [TroopType.Paladin]: "paladin",
};

/** A hex of the game's own, as contracts count it, from a normalized one and back. */
export const contractHexOf = (hex: Hex): Hex => ({ col: hex.col + FELT_CENTER(), row: hex.row + FELT_CENTER() });
const normalizedHexOf = (hex: Hex): Hex => ({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });

/** What the projection tells of a tile or a structure that changed: where it was and where it is. */
interface PlacedChange {
  readonly previous?: { readonly hexCoords: Hex & { readonly alt: boolean } };
  readonly current?: { readonly hexCoords: Hex & { readonly alt: boolean } };
}

/** The hexes of the layer shown that a list of changes touches, normalized: where each thing was and where it is now. */
export function changedHexes(changes: readonly PlacedChange[]): Hex[] {
  return changes
    .flatMap((change) => [change.previous, change.current])
    .flatMap((placed) =>
      placed && placed.hexCoords.alt === activeMapLayer() ? [normalizedHexOf(placed.hexCoords)] : [],
    );
}

/** Every explored tile of the layer shown, its hex normalized. */
export function readTiles(projection: WorldSpatialProjection): ExploredTile[] {
  return projection.getTiles(activeMapLayer()).map((tile) => ({
    ...normalizedHexOf(tile.hexCoords),
    biome: tile.biome,
    occupied: tile.occupierIsStructure,
  }));
}

/** Every structure of the layer shown with the hex it stands on. */
export function readStructures(projection: WorldSpatialProjection): MapStructure[] {
  return projection.getStructures(activeMapLayer()).map((structure) => ({
    entityId: structure.entityId === null ? null : Number(structure.entityId),
    hex: normalizedHexOf(structure.hexCoords),
    occupierType: structure.occupierType,
  }));
}

/**
 * Everything of the layer shown that stands on a hex without being a structure, with the model today's map draws it
 * as: a spire, lit or dormant, and a shrine or a well, which the tile itself tells of; and a chest.
 */
export function readLandmarks(projection: WorldSpatialProjection): MapLandmark[] {
  const layer = activeMapLayer();
  const onTiles = projection.getTiles(layer).flatMap((tile) => {
    const path = landmarkModelOf(tile.occupierType);
    return path ? [{ hex: normalizedHexOf(tile.hexCoords), path }] : [];
  });
  const chests = projection
    .getChests(layer)
    .map((chest) => ({ hex: normalizedHexOf(chest.hexCoords), path: ChestModelPath }));
  return [...onTiles, ...chests];
}

function landmarkModelOf(occupierType: number): string | null {
  if (occupierType === TileOccupier.Spire || occupierType === TileOccupier.DormantSpire) return SPIRE_MODEL_PATH;
  const site = mapSiteOf(occupierType);
  return site ? mapSiteModelPath(site.kind) : null;
}

/** Every army of the layer shown where it stands on the ground, as its troop's build, in its side's colour. */
export function readArmies(projection: WorldSpatialProjection, store: NativeFactStore): MapArmy[] {
  const owners = new Map<number, bigint>();
  for (const explorer of store.inGame("ExplorerTroops", configManager.getActiveGameId())) {
    owners.set(Number(explorer.explorer_id), getExplorerOwner(store, explorer));
  }
  return projection.getArmies(activeMapLayer()).map((army) => {
    const hex = normalizedHexOf(army.hexCoords);
    return {
      entityId: Number(army.entityId),
      at: worldHexToWorld(hex.col, hex.row),
      build: BUILD_OF_TROOP[army.troopCategory],
      tint: sideTint(store, owners.get(Number(army.entityId))),
    };
  });
}

/**
 * A side's colour as the renderer tints by it: a watching viewer sees each player's seat colour, a playing one
 * their own, their allies' and everyone else's, by the same rule as the map's labels and the minimap.
 */
function sideTint(store: NativeFactStore, owner: bigint | undefined): [number, number, number] {
  const viewer = accountAddress();
  const watched = watchedSide(store, owner ?? null);
  const colour =
    watched?.colour ??
    SIDE_HEX[
      sideOf({
        isMine: viewer !== null && owner !== undefined && owner === BigInt(viewer),
        isAlly: arePlayersAllied(store, viewer, owner),
        owner: { address: owner ?? 0n },
      })
    ];
  return new Color(colour).toArray() as [number, number, number];
}
