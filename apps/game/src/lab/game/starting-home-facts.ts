import { NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { type LabFact, wire } from "./lab-chain";

export const UNLIMITED_OUTPUT = (1n << 128n) - 1n;

export function startingHomeFacts(founded: LabFact[], store: NativeFactStore, now: number): LabFact[] {
  const parsed = new NativeFactStore();
  parsed.applyFacts(founded as never);
  const realm = parsed.require("Structure", { game_id: 1, entity_id: 7 });
  const rules = store.require("SliceRules", { game_id: 1 });
  return [
    ...homeRows(founded, realm, rules),
    ...startingBalances(realm.entity_id),
    ...castleProductionRows(realm.entity_id, store, now),
  ];
}

function castleProductionRows(home: bigint, store: NativeFactStore, now: number): LabFact[] {
  return [
    {
      model: "ResourceProduction",
      key: "0xb300",
      value: wire({
        remainder: 0,

        game_id: 1,
        entity_id: home,
        resource_type: ResourcesIds.Labor,
        building_count: 1,
        production_rate: store.require("ResourceRule", { game_id: 1, resource_type: ResourcesIds.Labor }).realm_rate,
        output_amount_left: UNLIMITED_OUTPUT,
        last_settled_at: now,
      }),
    },
    {
      model: "Building",
      key: "0xb301",
      value: wire({
        game_id: 1,
        structure_id: home,
        inner_col: 10,
        inner_row: 10,
        category: BuildingType.ResourceLabor,
        paused: false,
        labor_paid: 0,
      }),
    },
  ];
}

function startingBalances(home: bigint): LabFact[] {
  const starting = frontierSeasonOnePreset.balance.startingResources;
  return [...starting, { resource: ResourcesIds.Essence, amount: 0 }].map(
    ({ resource, amount }): LabFact => ({
      model: "ResourceBalance",
      key: `0xb10${resource.toString(16)}`,
      value: wire({
        game_id: 1,
        entity_id: home,
        resource_type: resource,
        balance: BigInt(amount) * BigInt(RESOURCE_PRECISION),
      }),
    }),
  );
}

function homeRows(founded: LabFact[], realm: NativeRows["Structure"], rules: NativeRows["SliceRules"]): LabFact[] {
  return founded.flatMap((row): LabFact[] => {
    if (row.model === "Structure")
      return [{ ...row, value: wire({ ...realm, base: { ...realm.base, starting_troops_granted: true } }) }];
    if (row.model === "ResourceWeight")
      return [
        { ...row, value: wire({ game_id: 1, entity_id: realm.entity_id, capacity: (1n << 128n) - 1n, weight: 0n }) },
      ];
    if (row.model === "RealmKnowledge")
      return [{ ...row, value: wire({ game_id: 1, structure_id: realm.entity_id, learned: 0 }) }];
    if (row.model === "StructureBuildings")
      return [
        {
          ...row,
          value: wire({
            game_id: 1,
            entity_id: realm.entity_id,
            packed_counts_1: 0,
            packed_counts_2: 1n << 64n,
            packed_counts_3: 0,
            population: { current: 0, max: rules.building_config.base_population },
          }),
        },
      ];
    return [];
  });
}
