import { BuildingType, ContractAddress, ID, ResourcesIds } from "@bibliothecadao/types";
import type { SiteKind } from "../utils/expeditions";

export const TROOP_TIERS: Record<string, number> = {
  T1: 1,
  T2: 2,
  T3: 3,
};

export interface GuardArmy {
  slot: number;
  category: string | null;
  tier: number;
  count: number;
}

export type BuildingSystemUpdate = {
  buildingType: BuildingType;
  innerCol: number;
  innerRow: number;
  paused: boolean;
};

export type ExplorerRewardSystemUpdate = {
  explorerId: ID;
  explorerStructureId: ID;
  explorerOwnerAddress: ContractAddress | null;
  resourceId: ResourcesIds | 0;
  amount: number;
  rawAmount: bigint | number | string | null;
  /** The revealed tile the reward came from, in contract coordinates. */
  coord: { x: number; y: number };
  timestamp: number;
};
/**
 * A site cleared, as its payout story and the winning exchange before it tell it (one transaction): what the site was,
 * what it paid home in whole units (beasts pay only XP, a ruin its chest), where it stood and what the fight cost.
 */
export type SitePayoutSystemUpdate = {
  explorerId: ID;
  siteId: ID;
  ownerAddress: bigint | null;
  kind: SiteKind;
  reward: { resourceId: ResourcesIds; amount: number } | null;
  /** The site's tile, in contract coordinates. */
  coord: { x: number; y: number };
  /** Whole troops the army lost in the winning exchange. */
  troopsLost: number;
};
export type ChestReward = { kind: "relics"; relics: ResourcesIds[] } | { kind: "lords"; amount: number };

/** The actual opening result; LORDS amounts are whole units, as the reward-chest story records them. */
export type ChestOpenedSystemUpdate = ChestReward & {
  /** The opening as the game's history titles it: its reward and recipient. */
  title: string;
  explorerId: ID;
  hex: { x: number; y: number };
  timestamp: number;
};

export interface SelectableArmy {
  entityId: ID;
}

export type BattleEventSystemUpdate = {
  entityId: ID;
  battleData: {
    attackerId: ID;
    defenderId: ID;
    attackerOwner: ID;
    defenderOwner: ID;
    winnerId: ID;
    maxReward: Array<{ resourceType: number; amount: number }>;
    timestamp: number;
  };
};

export type StoryEventSystemUpdate = {
  ownerAddress: string | null;
  ownerName: string | null;
  entityId: ID | null;
  txHash: string;
  timestamp: number;
  storyType: string;
  storyPayload: Record<string, unknown> | null;
  rawStory: unknown;
  /** The player the story is told to, who reads as "you" where a story names them; null for a spectator. */
  viewerAddress: string | null;
};

export enum StructureProgress {
  STAGE_1 = 0,
  STAGE_2 = 1,
  STAGE_3 = 2,
}
