import { BigNumberish } from "starknet";

export type Npc = {
  entityId: BigNumberish;
  currentRealmEntityId: BigNumberish;
  characteristics: Characteristics;
  characterTrait: string;
  fullName: string;
};

export type Characteristics = {
  age: number;
  role: string;
  sex: string;
};

export type SortVillagers = {
  residents: Villager[];
  travelers: Villager[];
  atGates: Villager[];
};

export enum VillagerType {
  Resident,
  Traveler,
  AtGates,
  Unknown,
}

export type Villager = {
  npc: Npc;
  type: VillagerType;
  native: boolean;
};

export type DiscussionSegment = {
  npcEntityId: number;
  segment: string;
};

export type StorageDiscussion = {
  viewed: boolean;
  dialogue: DiscussionSegment[];
};

export type StorageDiscussions = {
  [key: number]: StorageDiscussion;
};

export type DiscussionRpcResponse = {
  dialogue: DiscussionSegment[];
  inputScore: number;
  realmId: number;
  timestamp: number;
  userInput: string;
};

export type NpcSpawnResponse = {
  npc: {
    characteristics: { age: number; role: number; sex: number };
    characterTrait: string;
    fullName: string;
    description: string;
  };
  signature: BigInt[];
};