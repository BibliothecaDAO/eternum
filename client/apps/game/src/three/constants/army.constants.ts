import { TroopTier, TroopType } from "@bibliothecadao/types";
import { ModelType } from "../types/army.types";

export const MAX_INSTANCES = 1000;
export const ANIMATION_STATE_IDLE = 0;
export const ANIMATION_STATE_MOVING = 1;

export const TROOP_TO_MODEL: Record<TroopType, Record<TroopTier, ModelType>> = {
  [TroopType.Knight]: {
    [TroopTier.T1]: ModelType.Knight1,
    [TroopTier.T2]: ModelType.Knight2,
    [TroopTier.T3]: ModelType.Knight3,
  },
  [TroopType.Crossbowman]: {
    [TroopTier.T1]: ModelType.Crossbowman1,
    [TroopTier.T2]: ModelType.Crossbowman2,
    [TroopTier.T3]: ModelType.Crossbowman3,
  },
  [TroopType.Paladin]: {
    [TroopTier.T1]: ModelType.Paladin1,
    [TroopTier.T2]: ModelType.Paladin2,
    [TroopTier.T3]: ModelType.Paladin3,
  },
};

export const MODEL_TYPE_TO_FILE: Record<ModelType, string> = {
  [ModelType.Boat]: "boat",
  [ModelType.Knight1]: "knight1",
  [ModelType.Knight2]: "knight2",
  [ModelType.Knight3]: "knight3",
  [ModelType.Crossbowman1]: "archer1",
  [ModelType.Crossbowman2]: "archer2",
  [ModelType.Crossbowman3]: "archer3",
  [ModelType.Paladin1]: "paladin1",
  [ModelType.Paladin2]: "paladin2",
  [ModelType.Paladin3]: "paladin3",
};
