import type { BuildingType, HexPosition, ID } from "@bibliothecadao/types";

import { TileManager } from "../../managers/tile-manager";
import type { GameClient } from "../game-client";
import { requireSigner } from "./signer";

export interface PlaceBuildingInput {
  structureId: ID;
  buildingType: BuildingType;
  /** The slot inside the structure's local grid. */
  hex: HexPosition;
  useSimpleCost: boolean;
}

export interface BuildingSlotInput {
  structureId: ID;
  hex: HexPosition;
}

export type PlaceBuildingResult = Awaited<ReturnType<TileManager["placeBuilding"]>>;

export const placeBuilding = async (client: GameClient, input: PlaceBuildingInput): Promise<PlaceBuildingResult> =>
  structureTiles(client, input.structureId).placeBuilding(
    requireSigner(client),
    input.structureId,
    input.buildingType,
    input.hex,
    input.useSimpleCost,
  );

export const destroyBuilding = async (client: GameClient, input: BuildingSlotInput): Promise<void> =>
  structureTiles(client, input.structureId).destroyBuilding(
    requireSigner(client),
    input.structureId,
    input.hex.col,
    input.hex.row,
  );

export const pauseProduction = async (client: GameClient, input: BuildingSlotInput): Promise<void> =>
  structureTiles(client, input.structureId).pauseProduction(
    requireSigner(client),
    input.structureId,
    input.hex.col,
    input.hex.row,
  );

export const resumeProduction = async (client: GameClient, input: BuildingSlotInput): Promise<void> =>
  structureTiles(client, input.structureId).resumeProduction(
    requireSigner(client),
    input.structureId,
    input.hex.col,
    input.hex.row,
  );

const structureTiles = (client: GameClient, structureId: ID): TileManager =>
  TileManager.forStructure(client.setup.components, client.setup.systemCalls, structureId);
