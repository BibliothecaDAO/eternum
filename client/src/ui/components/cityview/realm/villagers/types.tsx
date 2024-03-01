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
  fullName: string;
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
  townhall_id: number;
  townhall: string;
};

export type NpcSpawnResponse = {
  npc: {
    characteristics: { age: number; role: number; sex: number };
    character_trait: string;
    full_name: string;
    description: string;
  };
  signature: BigInt[];
};

export type ErrorResponse = {
  reason: string;
};

export type WsResponse = {
  msg_type: WsMsgType;
  data: NpcSpawnResponse | TownhallResponse | ErrorResponse;
};

export enum WsMsgType {
  TOWNHALL = 0,
  SPAWN_NPC = 1,
  ERROR = 255,
}
