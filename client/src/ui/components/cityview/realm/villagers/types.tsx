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

export type TownhallRecord = {
  [key: string]: NpcTownhallMessage[];
};

export type NpcChatProps = {
  spawned: number;
  realmId: bigint;
  selectedTownhall: string | null;
  setSelectedTownhall: (newIndex: string | null) => void; 
}

export type Message = {
  [key: string]: string;
}