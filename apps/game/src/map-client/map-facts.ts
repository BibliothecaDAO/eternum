import { configManager, FELT_CENTER, getExplorerOwner } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { TroopType } from "@bibliothecadao/types";
import { Color } from "three";

import { accountAddress } from "@/hooks/store/use-account-store";
import { worldHexToWorld } from "@/three/world-origin";
import { SIDE_HEX } from "@/tokens";
import { arePlayersAllied, sideOf, watchedSide } from "@/utils/entity-ownership";

import type { MapArmy, TroopBuild } from "./army-marches";
import type { ExploredTile, Hex } from "./land-from-facts";
import type { MapStructure } from "./scene-from-land";

/** Which of the renderer's builds each troop is drawn as. */
const BUILD_OF_TROOP: Record<TroopType, TroopBuild> = {
  [TroopType.Knight]: "knight",
  [TroopType.Crossbowman]: "crossbowman",
  [TroopType.Paladin]: "paladin",
};

/** The surface layer: the map client does not draw the ethereal layer yet. */
const SURFACE = false;

/** A hex of the game's own, as contracts count it, from a normalized one and back. */
export const contractHexOf = (hex: Hex): Hex => ({ col: hex.col + FELT_CENTER(), row: hex.row + FELT_CENTER() });
const normalizedHexOf = (hex: Hex): Hex => ({ col: hex.col - FELT_CENTER(), row: hex.row - FELT_CENTER() });

/** What the projection tells of a tile or a structure that changed: where it was and where it is. */
interface PlacedChange {
  readonly previous?: { readonly hexCoords: Hex & { readonly alt: boolean } };
  readonly current?: { readonly hexCoords: Hex & { readonly alt: boolean } };
}

/** The surface hexes a list of changes touches, normalized: where each thing was and where it is now. */
export function changedHexes(changes: readonly PlacedChange[]): Hex[] {
  return changes
    .flatMap((change) => [change.previous, change.current])
    .flatMap((placed) => (placed && placed.hexCoords.alt === SURFACE ? [normalizedHexOf(placed.hexCoords)] : []));
}

/** Every explored tile of the surface, its hex normalized. */
export function readTiles(projection: WorldSpatialProjection): ExploredTile[] {
  return projection.getTiles(SURFACE).map((tile) => ({
    ...normalizedHexOf(tile.hexCoords),
    biome: tile.biome,
    occupied: tile.occupierIsStructure,
  }));
}

/** Every structure of the surface with the hex it stands on. */
export function readStructures(projection: WorldSpatialProjection): MapStructure[] {
  return projection.getStructures(SURFACE).map((structure) => ({
    entityId: structure.entityId === null ? null : Number(structure.entityId),
    hex: normalizedHexOf(structure.hexCoords),
    occupierType: structure.occupierType,
  }));
}

/** Every army of the surface where it stands on the ground, as its troop's build, in its side's colour. */
export function readArmies(projection: WorldSpatialProjection, store: NativeFactStore): MapArmy[] {
  const owners = new Map<number, bigint>();
  for (const explorer of store.inGame("ExplorerTroops", configManager.getActiveGameId())) {
    owners.set(Number(explorer.explorer_id), getExplorerOwner(store, explorer));
  }
  return projection.getArmies(SURFACE).map((army) => {
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
