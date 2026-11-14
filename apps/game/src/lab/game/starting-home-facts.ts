import { entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";
import { NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildingType, getNeighborHexes, RESOURCE_PRECISION, ResourcesIds, TileOccupier } from "@bibliothecadao/types";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { type LabFact, wire } from "./lab-chain";

/** The founding response uses the preset's stock and the allocator's two independent slots. */
export function startingHomeFacts(founded: LabFact[], store: NativeFactStore, now: number): LabFact[] {
  const parsed = new NativeFactStore();
  parsed.applyFacts(founded as never);
  const realm = parsed.require("Structure", { game_id: 1, entity_id: 7 });
  const rules = store.require("SliceRules", { game_id: 1 });
  const location = expeditionRealmSite(readExpeditionRules(store, 1)!, entityHomeNamespace(realm.entity_id), now)!;
  const neighbors = getNeighborHexes(location.col, location.row);
  const troops = [...parsed.entries("ExplorerTroops")][0]![1].troops;
  return [
    ...homeRows(founded, realm, rules),
    ...startingBalances(realm.entity_id),
    ...castleProductionRows(realm.entity_id, store, now),
    ...[0, 1].flatMap((slot) => startingArmyRows(realm, troops, rules, slot, neighbors[slot]!, now)),
  ];
}

function castleProductionRows(home: bigint, store: NativeFactStore, now: number): LabFact[] {
  return [
    {
      model: "ResourceProduction",
      key: "0xb300",
      value: wire({
        game_id: 1,
        entity_id: home,
        resource_type: ResourcesIds.Labor,
        building_count: 1,
        production_rate: store.require("ResourceRule", { game_id: 1, resource_type: ResourcesIds.Labor }).realm_rate,
        output_amount_left: (1n << 128n) - 1n,
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
        balance: BigInt(resource === ResourcesIds.Knight ? 0 : amount) * BigInt(RESOURCE_PRECISION),
      }),
    }),
  );
}

function startingArmyRows(
  realm: NativeRows["Structure"],
  troops: NativeRows["ExplorerTroops"]["troops"],
  rules: NativeRows["SliceRules"],
  slot: number,
  { col, row }: { col: number; row: number },
  now: number,
): LabFact[] {
  const knights = frontierSeasonOnePreset.balance.startingResources.find(
    ({ resource }) => resource === ResourcesIds.Knight,
  )!.amount;
  const id = BigInt(entityHomeNamespace(realm.entity_id)) * 0x100000000n + BigInt(slot + 2);
  const army: NativeRows["ExplorerTroops"] = {
    game_id: 1,
    explorer_id: id,
    owner: realm.entity_id,
    troops: {
      ...troops,
      category: "Knight",
      tier: "T1",
      count: BigInt(knights / 2) * BigInt(RESOURCE_PRECISION),
      stamina: { Slot: slot },
    },
  };
  return [
    { model: "ExplorerTroops", key: `0xb20${slot}`, value: wire(army) },
    { model: "ArmyDay", key: `0xb21${slot}`, value: wire({ game_id: 1, explorer_id: id, day: 0 }) },
    {
      model: "ArmySlot",
      key: `0xb22${slot}`,
      value: wire({
        game_id: 1,
        structure_id: realm.entity_id,
        epoch: 0,
        slot,
        explorer_id: id,
        stamina: { amount: rules.troop_stamina_config.stamina_knight_max, settled_at: now, remainder: 0 },
      }),
    },
    {
      model: "ArmyProgress",
      key: `0xb23${slot}`,
      value: wire({
        game_id: 1,
        explorer_id: id,
        xp: 0,
        common_points: 0,
        uncommon_points: 0,
        rare_points: 0,
        epic_points: 0,
        legendary_points: 0,
        battle: 0,
        logistics: 0,
        scouting: 0,
        scouting_kinds: 0,
        homecoming: 0,
      }),
    },
    {
      model: "TileOccupancy",
      key: `0xb24${slot}`,
      value: wire({
        game_id: 1,
        alt: false,
        col,
        row,
        entity_id: id,
        category: TileOccupier.ExplorerKnightT1,
        is_structure: false,
      }),
    },
  ];
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
