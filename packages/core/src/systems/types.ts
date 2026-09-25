import { BuildingType, ContractAddress, ID, ResourcesIds } from "@bibliothecadao/types";

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
/** An army's answer to its attribute offer: the attribute raised, the levels it gained and any lost past the cap. */
export type AttributeChosenSystemUpdate = {
  explorerId: ID;
  offerId: number;
  attribute: "Battle" | "Logistics" | "Scouting" | "Support";
  applied: number;
  lost: number;
};
/** A Frontier chest opened on capture: what the army found and how deep it stood. */
export type ChestRewardSystemUpdate = {
  resultKey: readonly [gameId: string, order: string, index: string];
  explorerId: ID;
  kind: "Relic" | "Cosmetic" | "Token";
  quality: number;
  depth: number;
  timestamp: number;
};

/** A relic crate opened by an explorer: the contract hex it stood on and the relics it yielded. */
export type RelicChestOpenedSystemUpdate = {
  explorerId: ID;
  hex: { x: number; y: number };
  relics: ResourcesIds[];
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
};

export enum StructureProgress {
  STAGE_1 = 0,
  STAGE_2 = 1,
  STAGE_3 = 2,
}
