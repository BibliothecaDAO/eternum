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

export type Residents = {
  natives: Npc[];
  foreigners: Npc[];
};

export type Travelers = Npc[];

export type AtGates = Npc[];

export type NpcTownhallMessage = {
  fullName: string;
  dialogueSegment: string;
};

export type StorageTownhall = {
  viewed: boolean;
  dialogue: NpcTownhallMessage[];
};

export type StorageTownhalls = {
  [key: number]: StorageTownhall;
};

export type TownhallResponse = {
  townhallId: number;
  dialogue: NpcTownhallMessage[];
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

export type ErrorResponse = {
  reason: string;
};

export type WsResponse = {
  msgType: WsMsgType;
  data: NpcSpawnResponse | TownhallResponse | ErrorResponse;
};

export enum WsMsgType {
  TOWNHALL = 0,
  SPAWN_NPC = 1,
  ERROR = 255,
}
