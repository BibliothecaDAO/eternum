import { BigNumberish } from "starknet";

export type Mood = {
  hunger: Number;
  happiness: Number;
  beligerent: Number;
};

export type Npc = {
  entityId: BigNumberish;
  mood: Mood;
  role: Number;
  sex: Number;
  realm_id: Number;
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

export type NpcChatProps = {
  townHallRequest: number;
};

export type TownhallResponse = {
  id: number;
  townhall: string;
};
