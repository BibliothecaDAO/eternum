import { POINTS } from "@/ui/design-system/kit/words";
import {
  configManager,
  divideByPrecision,
  getBlockTimestamp,
  readResourceManager,
  siteKindOf,
  siteReward,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import type { StructureInfo } from "../types";
import type { PlateReward } from "./map-plate-model";

type RewardSource = Pick<StructureInfo, "entityId" | "structureType" | "mineKind" | "owner">;

/** A Blitz Essence Rift: a mine whose Essence grows every second, so its plate is said again each second. */
export const holdsGrowingEssence = (structure: Pick<StructureInfo, "structureType" | "mineKind">): boolean =>
  structure.structureType === StructureType.Mine && structure.mineKind === 1;

/**
 * What taking a camp or a rift still gives, as its tile card says, read from the game's facts as they stand: a Frontier
 * site's payout home until it is cleared (it pays once); in Blitz, the Essence a rift holds (it changes hands with it),
 * and for a camp the points for taking it from the Vanguard. Nothing for anything else.
 */
export const readPlateReward = (store: NativeFactStore, structure: RewardSource): PlateReward | undefined => {
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: structure.entityId });
  if (site) {
    const payout = siteReward(siteKindOf(structure.structureType), site);
    return payout
      ? { amount: divideByPrecision(Number(payout.amount)), unit: ResourcesIds[payout.resourceType] }
      : undefined;
  }
  if (holdsGrowingEssence(structure)) {
    const held = readResourceManager(store, structure.entityId).balanceWithProduction(
      getBlockTimestamp().currentDefaultTick,
      ResourcesIds.Essence,
    );
    return held ? { amount: divideByPrecision(held.balance), unit: ResourcesIds[ResourcesIds.Essence] } : undefined;
  }
  if (structure.structureType === StructureType.Camp && structure.owner.address === 0n) {
    return { amount: configManager.getVictoryPointGrants().claimCampFromBandits, unit: POINTS };
  }
  return undefined;
};
