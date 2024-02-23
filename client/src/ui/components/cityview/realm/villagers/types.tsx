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
  selectedTownhall: number | null;
  setSelectedTownhall: (newIndex: number | null) => void;
  loadingTownhall: boolean;
  setLoadingTownhall: (loading: boolean) => void;
  lastMessageDisplayedIndex: number;
  setLastMessageDisplayedIndex: (newIndex: number) => void;
};

export type Message = {
  id: number;
  townhall: string;
};
