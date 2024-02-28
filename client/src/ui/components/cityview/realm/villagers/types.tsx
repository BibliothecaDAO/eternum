import { BigNumberish } from "starknet";

export type Characteristics = {
  age: number;
  role: string;
  sex: string;
};

export type Npc = {
  entityId: BigNumberish;
  realmEntityId: BigInt;
  characteristics: Characteristics;
  characterTrait: string;
  name: string;
};

export type NpcTownhallMessage = {
  npcName: string;
  dialogueSegment: string;
};

export type StorageTownhall = {
  viewed: boolean;
  discussion: NpcTownhallMessage[];
};

export type StorageTownhalls = {
  [key: number]: StorageTownhall;
};

export type NpcChatProps = {};

export type TownhallResponse = {
  type: WsMsgType;
  id: number;
  townhall: string;
};

export type NpcProfile = {
  fullName: string;
  characterTrait: string;
  sex: number;
  description: string;
  age: number;
  role: number;
};

export type NpcSpawnResponse = {
  type: WsMsgType;
  npc: NpcProfile;
};

export type WsResponse = {
  type: WsMsgType;
  data: any;
};

export enum WsMsgType {
  TOWNHALL = 0,
  SPAWN_NPC = 1,
}
