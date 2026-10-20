import { TroopTier, TroopType } from "@bibliothecadao/types";
import { ModelType } from "../types/army";

export const MAX_INSTANCES = 1000;
/**
 * How far above its tile an army's label point sits, where its token's foot stands (the owner, 2026-10-20: "label should
 * be above not on the army"). The tallest army as drawn (grounded, a ship at its waterline) is a T3 ship at 1.28, a
 * paladin within 0.01 of it: 1.45 stands 0.17 over it, and 0.43 over the T1 knight (1.02), near the 0.45 a structure's
 * label keeps over its own model. The asset check measures every army as drawn against it.
 */
export const ARMY_PLATE_HEIGHT = 1.45;
/** The shipped T1 knight's articulated model: authored 0.6135 tall, drawn at the old T1 model's 1.02 height. */
export const T1_KNIGHT_WORLD_SCALE = 1.67;
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

/** Armies keep their class and tier at sea; each pair sails its own hull. */
export const TROOP_TO_SHIP_MODEL: Record<TroopType, Record<TroopTier, ModelType>> = {
  [TroopType.Knight]: {
    [TroopTier.T1]: ModelType.ShipKnight1,
    [TroopTier.T2]: ModelType.ShipKnight2,
    [TroopTier.T3]: ModelType.ShipKnight3,
  },
  [TroopType.Crossbowman]: {
    [TroopTier.T1]: ModelType.ShipCrossbowman1,
    [TroopTier.T2]: ModelType.ShipCrossbowman2,
    [TroopTier.T3]: ModelType.ShipCrossbowman3,
  },
  [TroopType.Paladin]: {
    [TroopTier.T1]: ModelType.ShipPaladin1,
    [TroopTier.T2]: ModelType.ShipPaladin2,
    [TroopTier.T3]: ModelType.ShipPaladin3,
  },
};

const SHIP_MODEL_TYPES: ReadonlySet<ModelType> = new Set(
  Object.values(TROOP_TO_SHIP_MODEL).flatMap((byTier) => Object.values(byTier)),
);

export const isShipModel = (modelType: ModelType | undefined): boolean =>
  modelType !== undefined && SHIP_MODEL_TYPES.has(modelType);

export const MODEL_TYPE_TO_FILE: Record<ModelType, string> = {
  [ModelType.Knight1]: "units/default_knight_lvl1.glb",
  [ModelType.Knight2]: "units/default_knight_lvl2.glb",
  [ModelType.Knight3]: "units/default_knight_lvl3.glb",
  [ModelType.Crossbowman1]: "units/default_crossbowman_lvl1.glb",
  [ModelType.Crossbowman2]: "units/default_crossbowman_lvl2.glb",
  [ModelType.Crossbowman3]: "units/default_crossbowman_lvl3.glb",
  [ModelType.Paladin1]: "units/default_paladin_lvl1.glb",
  [ModelType.Paladin2]: "units/default_paladin_lvl2.glb",
  [ModelType.Paladin3]: "units/default_paladin_lvl3.glb",
  [ModelType.ShipKnight1]: "ships/knight-t1.glb",
  [ModelType.ShipKnight2]: "ships/knight-t2.glb",
  [ModelType.ShipKnight3]: "ships/knight-t3.glb",
  [ModelType.ShipCrossbowman1]: "ships/crossbowman-t1.glb",
  [ModelType.ShipCrossbowman2]: "ships/crossbowman-t2.glb",
  [ModelType.ShipCrossbowman3]: "ships/crossbowman-t3.glb",
  [ModelType.ShipPaladin1]: "ships/paladin-t1.glb",
  [ModelType.ShipPaladin2]: "ships/paladin-t2.glb",
  [ModelType.ShipPaladin3]: "ships/paladin-t3.glb",
};

export const buildArmyModelAssetPath = (modelType: ModelType): string => {
  return `/models/${MODEL_TYPE_TO_FILE[modelType]}`;
};
