import {
  BUILDINGS_CENTER,
  BuildingType,
  getNeighborHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";

import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The first ring's six plots, each with a building, as a Settlement fills them before it is raised. */
const FIRST_RING = [
  BuildingType.WorkersHut,
  BuildingType.Storehouse,
  BuildingType.ResourceWheat,
  BuildingType.ResourceWood,
  BuildingType.ResourceStone,
  BuildingType.ResourceLabor,
];

/** Each castle level's price in labor, which the castle card reads (the HUD fixture's wheat price is none it takes). */
const levelPrice = (level: number) => BigInt(level * 3_000) * BigInt(RESOURCE_PRECISION);
const LABOR_HELD = 5_000n * BigInt(RESOURCE_PRECISION);

/**
 * The spire's game with realm 7 a full Settlement: its six first-ring plots built and the labor for a City. The chain
 * answers LevelUp as construction.cairo's level_up applies it, the price paid and the realm one level up, so a raised
 * realm's new ring can be seen in the realm view (/lab/game?scenario=realm, the Realm place, then the castle).
 */
export const realmScenario = (): LabScenario => {
  const spire = spireScenario();
  spire.store.applyFacts([...firstRingBuilt(), ...castlePriced()] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "LevelUp" ? raiseRealm(chain) : spire.answer(command, chain, now),
  };
};

const castlePriced = (): LabFact[] => [
  ...[1, 2, 3].map((level) => ({
    model: "UpgradeRecipe",
    key: `0xc${level}`,
    value: { game_id: 1, level, costs: [{ resource_type: ResourcesIds.Labor, amount: String(levelPrice(level)) }] },
  })),
  {
    model: "ResourceBalance",
    key: "0x1ab90",
    value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Labor, balance: String(LABOR_HELD) },
  },
];

const firstRingBuilt = (): LabFact[] =>
  getNeighborHexes(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]).map(({ col, row }, index) => ({
    model: "Building",
    key: `0x1ab8${index}`,
    value: {
      game_id: 1,
      structure_id: "7",
      inner_col: col,
      inner_row: row,
      category: FIRST_RING[index],
      paused: false,
      labor_paid: "0",
    },
  }));

/** The realm one level up, its labor less that level's price, each row under the key the chain holds it by. */
const raiseRealm = (chain: LabScenario["store"]): LabFact[] => {
  const [realmKey, realm] = [...chain.entries("Structure")].find(([, row]) => row.entity_id === 7n)!;
  const [laborKey, labor] = [...chain.entries("ResourceBalance")].find(
    ([, row]) => row.entity_id === 7n && row.resource_type === ResourcesIds.Labor,
  )!;
  const wire = JSON.parse(JSON.stringify(realm, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  return [
    { model: "Structure", key: realmKey, value: { ...wire, base: { ...wire.base, level: realm.base.level + 1 } } },
    {
      model: "ResourceBalance",
      key: laborKey,
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Labor,
        balance: String(labor.balance - levelPrice(realm.base.level + 1)),
      },
    },
  ];
};
