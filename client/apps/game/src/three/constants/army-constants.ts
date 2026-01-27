import { TroopTier, TroopType } from "@bibliothecadao/types";
import { ModelType } from "../types/army";

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
  [ModelType.Boat]: "units/boat.glb",
  [ModelType.Knight1]: "units/default_knight_lvl1.glb",
  [ModelType.Knight2]: "units/default_knight_lvl2.glb",
  [ModelType.Knight3]: "units/default_knight_lvl3.glb",
  [ModelType.Crossbowman1]: "units/default_crossbowman_lvl1.glb",
  [ModelType.Crossbowman2]: "units/default_crossbowman_lvl2.glb",
  [ModelType.Crossbowman3]: "units/default_crossbowman_lvl3.glb",
  [ModelType.Paladin1]: "units/default_paladin_lvl1.glb",
  [ModelType.Paladin2]: "units/default_paladin_lvl2.glb",
  [ModelType.Paladin3]: "units/default_paladin_lvl3.glb",
  [ModelType.AgentApix]: "agents/apix.glb",
  [ModelType.AgentElisa]: "agents/elisa.glb",
  [ModelType.AgentIstarai]: "agents/istarai.glb",
  [ModelType.AgentYP]: "agents/ypanther.glb",
};
