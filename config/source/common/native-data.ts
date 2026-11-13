import { RELICS } from "../../../packages/types/src/constants/relics";
// Tables from the pinned game rules, owned by the mode configuration.
const RESOURCE_ORDER = [3, 1, 2, 4, 6, 8, 5, 11, 7, 15, 14, 20, 13, 12, 16, 21, 18, 17, 10, 19, 9, 22];
const VILLAGE_WEIGHTS = [
  19815, 15556, 15062, 10556, 8951, 7130, 5031, 3920, 3673, 2531, 1358, 926, 988, 1049, 710, 741, 556, 494, 401, 278,
  185, 93,
];
export const villageResourcePool = RESOURCE_ORDER.map((resource_type, index) => ({
  resource_type,
  weight: VILLAGE_WEIGHTS[index],
}));

export const realmResourcePool = [3, 2, 4, 5, 11, 7, 19, 9, 22];

// Each relic's rate comes from the one relic table, in id order from Stamina Relic I (39).
export const relicRules = RELICS.toSorted((left, right) => left.id - right.id).map(({ rateBps: rate_bps }, index) => {
  const uses = index < 2 ? 3 : index === 6 ? 1 : index === 7 ? 2 : 0;
  const levelTwo = index % 2 === 1;
  const draw_weight = index === 14 || index === 15 ? 0 : index === 16 ? 600 : index === 17 ? 200 : levelTwo ? 400 : 750;
  return { rate_bps, duration: uses ? 0 : 3, uses, essence_cost: levelTwo ? 500 : 250, draw_weight };
});

export const withdrawalRetention = [0, 25, 50, 70, 85, 95].map((troop_percent, index) => ({
  troop_percent,
  resource_percent: [25, 50, 70, 85, 95, 95][index],
}));
