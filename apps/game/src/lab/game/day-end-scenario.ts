import { readExpeditionRules, setBuildingCount } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  BUILDINGS_CENTER,
  BuildingType,
  getNeighborHexes,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";

import { dayClock } from "@/ui/features/frontier/hud/day-clock";

import { type LabFact, type LabScenario, wire } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The rows changed here, under the keys their fixtures write them by (deploy, kit lab and site fixtures). */
const FIXTURE_KEYS = {
  realm: "0x7",
  knowledge: "0xd",
  buildings: "0xb7",
  army: "0x74",
  board: "0xa",
  rules: "0x100",
} as const;
const ruleKey = (resource: ResourcesIds) => `0x5${resource}`;

/** Frontier's production rates a second and explore cost (config/source/frontier), not the HUD fixture's. */
const WORKSHOP_RATE = 0.056;
const EXPLORE_STAMINA = 20;
const REALM_RATES: Partial<Record<ResourcesIds, number>> = {
  [ResourcesIds.Labor]: 0.028,
  [ResourcesIds.Knight]: 0.028,
  [ResourcesIds.Wheat]: 0.084,
};

/** The minutes left in the day when the lab opens: inside its last hour. */
const MINUTES_LEFT = 40;

/** What stands on the realm's first ring, besides the castle's own labor producer on its centre. */
const STANDING: BuildingType[] = [
  BuildingType.ResourceLabor,
  BuildingType.ResourceLabor,
  BuildingType.ResourceLabor,
  BuildingType.ResourceWheat,
  BuildingType.ResourceWheat,
  BuildingType.ResourceWheat,
];
const BARRACKS = 2;

/**
 * Workshop tier 2 (Tools, Tools), Farm tier 1 (Fields), Barracks tier 1 (Drill), as research.cairo packs them; the
 * Ethereal reaches the spire's realm learned stay.
 */
const LEARNED = (1n << 0n) | (2n << 7n) | (1n << 14n);
const PICKS: Partial<Record<number, number>> = {
  [ResourcesIds.Labor]: 2,
  [ResourcesIds.Wheat]: 1,
  [ResourcesIds.Knight]: 1,
};

/**
 * The spire's game in the day's last hour, the realm a City producing at Frontier's rates under its research: three Workshops (Tools twice),
 * three Farms (Fields) and two Barracks (Drill), the castle's own labor producer beside them, each store's rate as
 * buildings.cairo's board_output sums it; the army at Uncommon Logistics and Homecoming, 70 stamina held
 * (/lab/game?scenario=day-end).
 */
export const dayEndScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const rules = readExpeditionRules(store, 1)!;
  const { endsAt } = dayClock(rules, spire.startsAt);
  if (endsAt === undefined) throw new Error("The spire's game opens outside its season");
  const startsAt = endsAt - MINUTES_LEFT * 60;
  store.applyFacts(frontierRates(store) as never);
  store.applyFacts([...realmProducing(store), ...armyProgressed(store, startsAt), ...researchPriced()] as never);
  return { ...spire, startsAt };
};

const realmProducing = (store: NativeFactStore): LabFact[] => {
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const knowledge = store.require("RealmKnowledge", { game_id: 1, structure_id: 7 });
  const buildings = store.require("StructureBuildings", { game_id: 1, entity_id: 7 });
  const counts = new Map<BuildingType, number>([
    [BuildingType.ResourceLabor, 4],
    [BuildingType.ResourceWheat, 3],
    [BuildingType.ResourceKnightT1, BARRACKS],
  ]);
  const packed = [...counts].reduce<bigint[]>(
    (values, [category, count]) => setBuildingCount(category, values, count),
    [0n, 0n, 0n],
  );
  const plots = getNeighborHexes(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1]);
  const building = (key: string, col: number, row: number, category: BuildingType): LabFact => ({
    model: "Building",
    key,
    value: { game_id: 1, structure_id: "7", inner_col: col, inner_row: row, category, paused: false, labor_paid: "0" },
  });
  return [
    // A City: its second ring opens beside what stands, the two Barracks on it.
    { model: "Structure", key: FIXTURE_KEYS.realm, value: { ...wire(realm), base: { ...wire(realm.base), level: 1 } } },
    {
      model: "RealmKnowledge",
      key: FIXTURE_KEYS.knowledge,
      value: { ...wire(knowledge), learned: String(knowledge.learned | LEARNED) },
    },
    building("0x1ac00", BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], BuildingType.ResourceLabor),
    ...STANDING.map((category, index) => building(`0x1ac1${index}`, plots[index]!.col, plots[index]!.row, category)),
    ...Array.from({ length: BARRACKS }, (_, index) =>
      building(`0x1ac2${index}`, BUILDINGS_CENTER[0] + 2, BUILDINGS_CENTER[1] + index, BuildingType.ResourceKnightT1),
    ),
    {
      model: "StructureBuildings",
      key: FIXTURE_KEYS.buildings,
      value: {
        ...wire(buildings),
        packed_counts_1: String(packed[0]),
        packed_counts_2: String(packed[1]),
        packed_counts_3: String(packed[2]),
        population: { current: 10, max: 12 },
      },
    },
    production(store, ResourcesIds.Labor, 3, true),
    production(store, ResourcesIds.Wheat, 3, false),
    production(store, ResourcesIds.Knight, BARRACKS, false),
  ];
};

const scaled = (perSecond: number) => String(BigInt(Math.round(perSecond * RESOURCE_PRECISION)));

/** The game's rules with Frontier's explore cost, so a 120 bar is six explores. */
const exploreCost = (store: NativeFactStore): LabFact => {
  const rules = wire(store.require("SliceRules", { game_id: 1 })) as { troop_stamina_config: object };
  return {
    model: "SliceRules",
    key: FIXTURE_KEYS.rules,
    value: {
      ...rules,
      troop_stamina_config: { ...rules.troop_stamina_config, stamina_explore_stamina_cost: EXPLORE_STAMINA },
    },
  };
};

const frontierRates = (store: NativeFactStore): LabFact[] => [
  exploreCost(store),
  {
    model: "BoardRules",
    key: FIXTURE_KEYS.board,
    value: {
      ...wire(store.require("BoardRules", { game_id: 1 })),
      workshop_rate: scaled(WORKSHOP_RATE),
      output_step_bps: 2500,
    },
  },
  ...Object.entries(REALM_RATES).map(([resource, rate]) => ({
    model: "ResourceRule",
    key: ruleKey(Number(resource)),
    value: {
      ...wire(store.require("ResourceRule", { game_id: 1, resource_type: Number(resource) })),
      realm_rate: scaled(rate!),
    },
  })),
];

/** A store's ResourceProduction as board_output sums it: each building's base and its picks, plus the castle's labor. */
const production = (store: NativeFactStore, resource: ResourcesIds, buildings: number, castle: boolean): LabFact => {
  const board = store.require("BoardRules", { game_id: 1 });
  const realmRate = (of: ResourcesIds) => store.require("ResourceRule", { game_id: 1, resource_type: of }).realm_rate;
  const base = resource === ResourcesIds.Labor ? board.workshop_rate : realmRate(resource);
  const boosted = (base * BigInt(10_000 + (PICKS[resource] ?? 0) * board.output_step_bps)) / 10_000n;
  const rate = boosted * BigInt(buildings) + (castle ? realmRate(ResourcesIds.Labor) : 0n);
  return {
    model: "ResourceProduction",
    key: `1:7:${resource}`,
    value: {
      game_id: 1,
      entity_id: 7,
      resource_type: resource,
      building_count: buildings + (castle ? 1 : 0),
      production_rate: String(rate),
      output_amount_left: "0",
      last_settled_at: 1,
    },
  };
};

const armyProgressed = (store: NativeFactStore, startsAt: number): LabFact[] => {
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wired = wire(army) as { troops: object };
  return [
    {
      model: "ExplorerTroops",
      key: FIXTURE_KEYS.army,
      value: {
        ...wired,
        troops: { ...wired.troops, stamina: { Inline: { amount: "70", settled_at: startsAt, remainder: 0 } } },
      },
    },
    {
      model: "ArmyProgress",
      key: "1:201",
      value: {
        game_id: 1,
        explorer_id: "201",
        xp: 40,
        battle: 1,
        logistics: 2,
        scouting: 1,
        scouting_kinds: 0,
        homecoming: 3,
      },
    },
  ];
};

/** The research page's rules: each row's tier priced (Essence 2,000 and labor 1,000 a tier), and XP's prices. */
const researchPriced = (): LabFact[] => [
  ...Array.from({ length: research.ROW_COUNT }, (_, row) =>
    [1, 2, 3, 4].map((tier) => ({
      model: "ResearchPrice",
      key: `0x1ac3${row.toString(16)}${tier}`,
      value: {
        game_id: 1,
        row,
        tier,
        essence: String(BigInt(2_000 * tier) * BigInt(RESOURCE_PRECISION)),
        labor: String(BigInt(1_000 * tier) * BigInt(RESOURCE_PRECISION)),
      },
    })),
  ).flat(),
  {
    model: "ArmyProgressionRules",
    key: "0x1ac40",
    value: { game_id: 1, reveal_xp: 2, fixed_xp: 200, uncommon_xp: 100, rare_xp: 200, epic_xp: 400, legendary_xp: 800 },
  },
];
