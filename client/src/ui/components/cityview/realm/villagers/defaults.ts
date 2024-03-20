import { Npc } from "./types";
import { BigNumberish } from "starknet";
import { unpackCharacteristics } from "./utils";

export const defaultNpc: Npc = {
  entityId: 0 as BigNumberish,
  fullName: "",
  currentRealmEntityId: 0,
  characteristics: unpackCharacteristics(0n),
  characterTrait: "",
};
