// @vitest-environment node

import {
  BuildingType,
  CapacityConfig,
  defineContractComponents,
  TickIds,
  type Config,
  type ContractComponents,
} from "@bibliothecadao/types";
import { createWorld, setComponent, Type as RecsType } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientConfigManager } from "./config-manager";

const GAME_ID = 7;
const PRESET_ID = 2;

// Regression for the s2/preset migration bug: BuildingCategoryConfig rows are
// keyed [preset_id, category] when a preset is active, and a lookup built with
// the wrong key shape silently returned {population_cost: 0, capacity_grant: 0}
// for weeks — disabling the population UX. These tests use a real RECS world
// and the real getter (never mock getBuildingCategoryConfig: both prior suites
// mocked it, which is exactly how the bug survived CI).
describe("ClientConfigManager.getBuildingCategoryConfig (real config, no mocked getter)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the real preset-keyed values", () => {
    const components = createComponents();
    seedBuildingCategoryConfig(components, [BigInt(PRESET_ID), BigInt(BuildingType.WorkersHut)], {
      preset_id: PRESET_ID,
      category: BuildingType.WorkersHut,
      population_cost: 5,
      capacity_grant: 12,
    });
    const manager = createManagerForActiveGame(components);
    manager.markConfigSynced();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(manager.getBuildingCategoryConfig(BuildingType.WorkersHut)).toEqual({
      population_cost: 5,
      capacity_grant: 12,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns loudly, once per call site, when the key shape misses after markConfigSynced", () => {
    const components = createComponents();
    // Legacy key shape (no preset prefix) while the manager expects
    // [preset_id, category]: the exact silent-miss the guardrail must catch.
    seedBuildingCategoryConfig(components, [BigInt(BuildingType.WorkersHut)], {
      preset_id: 0,
      category: BuildingType.WorkersHut,
      population_cost: 5,
      capacity_grant: 12,
    });
    const manager = createManagerForActiveGame(components);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Misses before the initial sync completes are expected — stay quiet.
    expect(manager.getBuildingCategoryConfig(BuildingType.WorkersHut)).toEqual({
      population_cost: 0,
      capacity_grant: 0,
    });
    expect(warn).not.toHaveBeenCalled();

    manager.markConfigSynced();

    manager.getBuildingCategoryConfig(BuildingType.WorkersHut);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("config lookup returned empty after sync");

    // The same call site never spams, whatever the arguments.
    manager.getBuildingCategoryConfig(BuildingType.WorkersHut);
    manager.getBuildingCategoryConfig(BuildingType.Storehouse);
    expect(warn).toHaveBeenCalledTimes(1);

    // A different call site gets its own single warning.
    manager.getSeasonMainGameStartAt();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

// The rulebook getters (getTick, getCapacityConfigKg, ...) used to mask a
// missing PresetConfig row with `?? 0` inside their callbacks, so the loud
// layer above could never see the miss. These pin the converted behavior:
// row missing after sync → one warning + default; row present → real values.
describe("ClientConfigManager rulebook getters (missing preset row is loud)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getTick warns once when the preset rulebook row misses after sync", () => {
    const components = createComponents();
    // Rulebook data exists — but keyed under preset 1 while preset 2 is
    // active: the same wrong-key miss the building-category bug hid.
    seedPresetConfig(components, PRESET_ID - 1, {
      tick_config: { armies_tick_in_seconds: 42, delivery_tick_in_seconds: 7, bitcoin_phase_in_seconds: 0 },
    });
    const manager = createManagerForActiveGame(components);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Misses before the initial sync completes are expected — stay quiet.
    expect(manager.getTick(TickIds.Armies)).toBe(0);
    expect(warn).not.toHaveBeenCalled();

    manager.markConfigSynced();

    // TickIds.Default never reads config — silent even on a missing row.
    expect(manager.getTick(TickIds.Default)).toBe(1);
    expect(warn).not.toHaveBeenCalled();

    expect(manager.getTick(TickIds.Armies)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("config lookup returned empty after sync");

    // Warn-once per call site, whatever the tick id.
    manager.getTick(TickIds.Delivery);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("getCapacityConfigKg warns once on a missing row, but CapacityConfig.None stays silent", () => {
    const components = createComponents(); // no PresetConfig row at all
    const manager = createManagerForActiveGame(components);
    manager.markConfigSynced();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // None never reads config — must not warn.
    expect(manager.getCapacityConfigKg(CapacityConfig.None)).toBe(0);
    expect(warn).not.toHaveBeenCalled();

    expect(manager.getCapacityConfigKg(CapacityConfig.RealmStructure)).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("config lookup returned empty after sync");

    manager.getCapacityConfigKg(CapacityConfig.Donkey);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns real preset values without warning when the rulebook row is present", () => {
    const components = createComponents();
    seedPresetConfig(components, PRESET_ID, {
      tick_config: { armies_tick_in_seconds: 42, delivery_tick_in_seconds: 7, bitcoin_phase_in_seconds: 0 },
      capacity_config: {
        structure_capacity: 0n,
        troop_capacity: 0,
        donkey_capacity: 1_500,
        storehouse_boost_capacity: 0,
      },
      structure_capacity_config: {
        realm_capacity: 5_000_000,
        village_capacity: 0,
        hyperstructure_capacity: 0,
        fragment_mine_capacity: 0,
        bank_structure_capacity: 0,
        holysite_capacity: 0,
        camp_capacity: 0,
        bitcoin_mine_capacity: 0,
      },
    });
    const manager = createManagerForActiveGame(components);
    manager.markConfigSynced();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(manager.getTick(TickIds.Armies)).toBe(42);
    expect(manager.getTick(TickIds.Delivery)).toBe(7);
    // grams → kg
    expect(manager.getCapacityConfigKg(CapacityConfig.RealmStructure)).toBe(5_000);
    expect(manager.getCapacityConfigKg(CapacityConfig.Donkey)).toBe(1.5);
    expect(warn).not.toHaveBeenCalled();
  });
});

function createComponents(): ContractComponents {
  return defineContractComponents(createWorld(), "s2");
}

function createManagerForActiveGame(components: ContractComponents): ClientConfigManager {
  const manager = new ClientConfigManager();
  manager.setActiveGame(GAME_ID, PRESET_ID);
  manager.setDojo(components, {} as Config);
  return manager;
}

// RECS getComponentValue returns undefined unless EVERY schema key is set, and
// PresetConfig has ~35 members — so seed a zero-filled row and override only
// the structs the test reads.
function seedPresetConfig(components: ContractComponents, presetId: number, overrides: Record<string, unknown>) {
  const zeroFilled = Object.fromEntries(
    Object.entries(components.PresetConfig.schema).map(([key, fieldSchema]) => [key, zeroValueFor(fieldSchema)]),
  );
  setComponent(components.PresetConfig, getEntityIdFromKeys([BigInt(presetId)]), {
    ...zeroFilled,
    preset_id: presetId,
    ...overrides,
  } as never);
}

function zeroValueFor(fieldSchema: unknown): unknown {
  if (typeof fieldSchema === "object" && fieldSchema !== null) {
    return Object.fromEntries(Object.entries(fieldSchema).map(([key, nested]) => [key, zeroValueFor(nested)]));
  }
  switch (fieldSchema) {
    case RecsType.Boolean:
      return false;
    case RecsType.BigInt:
      return 0n;
    case RecsType.String:
      return "";
    case RecsType.NumberArray:
    case RecsType.BigIntArray:
    case RecsType.StringArray:
      return [];
    default:
      return 0;
  }
}

function seedBuildingCategoryConfig(
  components: ContractComponents,
  keys: bigint[],
  values: { preset_id: number; category: number; population_cost: number; capacity_grant: number },
) {
  setComponent(components.BuildingCategoryConfig, getEntityIdFromKeys(keys), {
    preset_id: values.preset_id,
    category: values.category,
    complex_erection_cost_id: 0,
    complex_erection_cost_count: 0,
    simple_erection_cost_id: 0,
    simple_erection_cost_count: 0,
    population_cost: values.population_cost,
    capacity_grant: values.capacity_grant,
  });
}
