import { BigNumberish } from "starknet";
import commonMaleNameList from "./commonMaleNameList.json";
import commonFemaleNameList from "./commonFemaleNameList.json";
import { Mood } from "./types";

const HUNGER_MASK = 0x0000ff;
const HAPPINESS_MASK = 0x00ff00;
const BELIGERENT_MASK = 0xff0000;

const MALE = 0;
const FEMALE = 1;

export const parseMoodFeltToStruct = (mood: BigNumberish): Mood => {
  return {
    hunger: HUNGER_MASK & Number(mood),
    happiness: (HAPPINESS_MASK & Number(mood)) >> 8,
    beligerent: (BELIGERENT_MASK & Number(mood)) >> 16,
  };
};

export const nameFromEntityId = (entityId: BigNumberish, sex: Number): string => {
  if (sex === MALE) {
    return commonMaleNameList[Number(entityId) % commonMaleNameList.length];
  }
  return commonFemaleNameList[Number(entityId) % commonFemaleNameList.length];
};
