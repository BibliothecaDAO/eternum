import { RealmLevels, ResourcesIds } from "../../../packages/types/src/constants";
import type { ResourceCost } from "../../../packages/types/src/types/common";
import type { ConfigPatch } from "../common/merge-config";

const REALM_MAX_LEVEL = Object.keys(RealmLevels).length / 2;
const VILLAGE_MAX_LEVEL = 1;
const REALM_UPGRADE_COSTS: Record<number, ResourceCost[]> = {
  [RealmLevels.Settlement]: [],
  [RealmLevels.City]: [
    { resource: ResourcesIds.Labor, amount: 180 },
    { resource: ResourcesIds.Wheat, amount: 1_200 },
    { resource: ResourcesIds.Fish, amount: 1_200 },
    { resource: ResourcesIds.Essence, amount: 200 },
  ],
  [RealmLevels.Kingdom]: [
    { resource: ResourcesIds.Labor, amount: 360 },
    { resource: ResourcesIds.Wheat, amount: 2_400 },
    { resource: ResourcesIds.Fish, amount: 2_400 },
    { resource: ResourcesIds.Essence, amount: 600 },
    { resource: ResourcesIds.Wood, amount: 180 },
  ],
  [RealmLevels.Empire]: [
    { resource: ResourcesIds.Labor, amount: 720 },
    { resource: ResourcesIds.Wheat, amount: 4_800 },
    { resource: ResourcesIds.Fish, amount: 4_800 },
    { resource: ResourcesIds.Essence, amount: 1_200 },
    { resource: ResourcesIds.Wood, amount: 360 },
    { resource: ResourcesIds.Coal, amount: 180 },
    { resource: ResourcesIds.Copper, amount: 180 },
  ],
};

export const eternumRealmLevelConfig: ConfigPatch = {
  realmUpgradeCosts: REALM_UPGRADE_COSTS,
  realmMaxLevel: REALM_MAX_LEVEL,
  villageMaxLevel: VILLAGE_MAX_LEVEL,
};
