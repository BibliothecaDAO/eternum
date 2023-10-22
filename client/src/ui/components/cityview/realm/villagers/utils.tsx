import { BigNumberish } from "starknet";

const HUNGER_MASK = 0x0000ff;
const HAPPINESS_MASK = 0x00ff00;
const BELIGERENT_MASK = 0xff0000;

export type Mood = {
  hunger: Number;
  happiness: Number;
  beligerent: Number;
};

export const parseMoodFeltToStruct = (mood: BigNumberish): Mood => {
  return {
    hunger: HUNGER_MASK & Number(mood),
    happiness: (HAPPINESS_MASK & Number(mood)) >> 8,
    beligerent: (BELIGERENT_MASK & Number(mood)) >> 16,
  };
};
