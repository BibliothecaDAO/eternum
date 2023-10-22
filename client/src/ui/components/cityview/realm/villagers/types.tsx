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
