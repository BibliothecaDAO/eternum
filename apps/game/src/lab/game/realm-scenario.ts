import { setBuildingCount } from "@bibliothecadao/eternum";
import {
  BUILDINGS_CENTER,
  BuildingType,
  getNeighborHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";

import type { LabFact, LabScenario } from "./lab-chain";
import { raceScenario } from "./race-scenario";
import { seasonOneResearchPrices } from "./season-one-research";
import { balancesPaid, spireScenario } from "./spire-scenario";

/**
 * The first ring's six plots, each with a building Frontier raises (frontier/build/building-names.ts), as a Settlement
 * fills them before it is raised.
 */
const FIRST_RING = [
  BuildingType.WorkersHut,
  BuildingType.ResourceWheat,
  BuildingType.ResourceLabor,
  BuildingType.ResourceKnightT1,
  BuildingType.ResourceWheat,
  BuildingType.SupplyYard,
];

/** Each castle level's price in labor, which the castle card reads (the HUD fixture's wheat price is none it takes). */
const levelPrice = (level: number) => BigInt(level * 3_000) * BigInt(RESOURCE_PRECISION);
/** Labor for every level up to an Empire (3,000 + 6,000 + 9,000), so each board size can be walked in the realm view. */
const LABOR_HELD = 18_000n * BigInt(RESOURCE_PRECISION);

/**
 * The spire's game with realm 7 a full Settlement: its six first-ring plots built and the labor to raise it to an Empire. The chain
 * answers LevelUp as construction.cairo's level_up applies it, the price paid and the realm one level up, so a raised
 * realm's new ring can be seen in the realm view (/lab/game?scenario=realm, the Realm place, then the castle).
 */
export const realmScenario = (): LabScenario => {
  const spire = spireScenario();
  const buildings = spire.store.require("StructureBuildings", { game_id: 1, entity_id: 7 });
  const counts = FIRST_RING.reduce<bigint[]>(
    (packed, category) => setBuildingCount(category, packed, FIRST_RING.filter((item) => item === category).length),
    [0n, 0n, 0n],
  );
  spire.store.applyFacts([
    ...firstRingBuilt(),
    ...castlePriced(),
    {
      model: "StructureBuildings",
      key: spire.store.wireKeyOf("StructureBuildings", { game_id: 1, entity_id: 7 })!,
      value: {
        ...buildings,
        packed_counts_1: counts[0],
        packed_counts_2: counts[1],
        packed_counts_3: counts[2],
        population: { ...buildings.population, current: FIRST_RING.length },
      },
    },
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "LevelUp" ? raiseRealm(chain) : spire.answer(command, chain, now),
  };
};

/** The castle's levels priced in labor alone, as the castle card reads them, and labor for realm 7 up to an Empire. */
export const castlePriced = (): LabFact[] => [
  ...castleRecipes(),
  {
    model: "ResourceBalance",
    key: "0x1ab90",
    value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Labor, balance: String(LABOR_HELD) },
  },
];

const castleRecipes = (): LabFact[] =>
  [1, 2, 3].map((level) => ({
    model: "UpgradeRecipe",
    key: `0xc${level}`,
    value: { game_id: 1, level, costs: [{ resource_type: ResourcesIds.Labor, amount: String(levelPrice(level)) }] },
  }));

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
  const wire = JSON.parse(JSON.stringify(realm, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  return [
    { model: "Structure", key: realmKey, value: { ...wire, base: { ...wire.base, level: realm.base.level + 1 } } },
    ...balancesPaid(chain, 7n, [{ resource: ResourcesIds.Labor, amount: levelPrice(realm.base.level + 1) }]),
  ];
};

const REALM_WORLD_STANDING = [BuildingType.ResourceLabor, BuildingType.ResourceWheat, BuildingType.ResourceKnightT1];

export const realmWorldScenario = (): LabScenario => {
  const race = raceScenario();
  const buildings = race.store.require("StructureBuildings", { game_id: 1, entity_id: 7 });
  const standingWithCastle = [BuildingType.ResourceLabor, ...REALM_WORLD_STANDING];
  const counts = standingWithCastle.reduce<bigint[]>(
    (packed, category) =>
      setBuildingCount(category, packed, standingWithCastle.filter((item) => item === category).length),
    [0n, 0n, 0n],
  );
  const plots = getNeighborHexes(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]).slice(0, REALM_WORLD_STANDING.length);
  const balanceFact = (resourceType: ResourcesIds, amount: bigint, fallbackKey: string): LabFact => ({
    model: "ResourceBalance",
    key:
      race.store.wireKeyOf("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: resourceType }) ?? fallbackKey,
    value: {
      game_id: 1,
      entity_id: 7,
      resource_type: resourceType,
      balance: String(amount * BigInt(RESOURCE_PRECISION)),
    },
  });
  race.store.applyFacts([
    ...plots.map(({ col, row }, index) => ({
      model: "Building",
      key: `0x1ac8${index}`,
      value: {
        game_id: 1,
        structure_id: "7",
        inner_col: col,
        inner_row: row,
        category: REALM_WORLD_STANDING[index],
        paused: false,
        labor_paid: "0",
      },
    })),
    ...castleRecipes(),
    ...seasonOneResearchPrices(race.store),
    balanceFact(ResourcesIds.Labor, 3_400n, "0x1ac90"),
    balanceFact(ResourcesIds.Wheat, 1_900n, "0x1ac91"),
    balanceFact(ResourcesIds.Essence, 420n, "0x1ac92"),
    {
      model: "StructureBuildings",
      key: race.store.wireKeyOf("StructureBuildings", { game_id: 1, entity_id: 7 })!,
      value: {
        ...buildings,
        packed_counts_1: counts[0],
        packed_counts_2: counts[1],
        packed_counts_3: counts[2],
        population: { ...buildings.population, current: REALM_WORLD_STANDING.length },
      },
    },
  ] as never);
  return {
    ...race,
    answer: (command, chain, now) =>
      command.kind === "LevelUp" ? raiseRealm(chain) : race.answer(command, chain, now),
  };
};
