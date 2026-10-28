import {
  configManager,
  divideByPrecision,
  getBlockTimestamp,
  readResourceManager,
  siteKindOf,
  siteReward,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { resourceName, ResourcesIds, RIFT_MINE_KIND, StructureType } from "@bibliothecadao/types";

import type { StructureInfo } from "../types";
import type { PlateReward } from "./map-plate-model";

type RewardSource = Pick<StructureInfo, "entityId" | "structureType" | "mineKind">;

/** What a Blitz Essence Rift (Essence) and a camp (Labor) hold, and change hands with; none for anything else. */
const heldResource = (structure: Pick<StructureInfo, "structureType" | "mineKind">): ResourcesIds | undefined => {
  if (structure.structureType === StructureType.Mine && structure.mineKind === RIFT_MINE_KIND)
    return ResourcesIds.Essence;
  if (structure.structureType === StructureType.Camp) return ResourcesIds.Labor;
  return undefined;
};

/** A place whose holding grows by the second, so its plate is said again each second. */
export const holdsGrowingReward = (structure: Pick<StructureInfo, "structureType" | "mineKind">): boolean =>
  heldResource(structure) !== undefined;

/**
 * What taking a camp or a rift still gives, as its tile card says, read from the game's facts as they stand: a Frontier
 * site's payout home until it is cleared (it pays once); in Blitz, what a rift or a camp holds (it changes hands with
 * it): a rift's Essence, a camp's Labor. Nothing for anything else.
 */
export const readPlateReward = (store: NativeFactStore, structure: RewardSource): PlateReward | undefined => {
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: structure.entityId });
  if (site) {
    const payout = siteReward(siteKindOf(structure.structureType), site);
    return payout
      ? { amount: divideByPrecision(Number(payout.amount)), unit: resourceName(payout.resourceType) }
      : undefined;
  }
  const resource = heldResource(structure);
  if (resource === undefined) return undefined;
  const held = readResourceManager(store, structure.entityId).balanceWithProduction(
    getBlockTimestamp().currentDefaultTick,
    resource,
  );
  return held ? { amount: divideByPrecision(held.balance), unit: resourceName(resource) } : undefined;
};
