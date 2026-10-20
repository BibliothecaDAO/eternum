import { describe, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { StructureType } from "@bibliothecadao/types";
import { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { getHyperstructureRates, hyperstructureRate, hyperstructureRateUnit } from "./hyperstructure";

vi.stubGlobal("localStorage", { getItem: () => null });

const grants = (hyperstructureScale: "flat" | "double" | "per-realm") => ({
  hyperstructurePerSecond: 1,
  hyperstructureScale,
});

describe("a Hyperstructure's one rate", () => {
  it("pays its holder the multiplier struck when it was taken, zero included, and has none while that is unknown", () => {
    const held = (struckMultiplier: number | null) =>
      hyperstructureRate(grants("per-realm"), { taken: true, struckMultiplier, realmsInScan: 2 });
    expect(held(3)).toEqual({ pointsPerSecond: 3, taken: true });
    expect(held(0)).toEqual({ pointsPerSecond: 0, taken: true });
    expect(held(null)).toBeNull();
  });

  it("shows an untaken one at what taking it now would pay: the realms the scan counts, two in a Duel, else one", () => {
    const untaken = { taken: false, struckMultiplier: null, realmsInScan: 2 };
    expect(hyperstructureRate(grants("per-realm"), untaken)?.pointsPerSecond).toBe(2);
    expect(hyperstructureRate(grants("double"), { ...untaken, realmsInScan: 5 })?.pointsPerSecond).toBe(2);
    expect(hyperstructureRate(grants("flat"), untaken)?.pointsPerSecond).toBe(1);
  });

  it("words the rate the same on every surface", () => {
    expect(hyperstructureRateUnit(true)).toBe("points/s");
    expect(hyperstructureRateUnit(false)).toBe("points/s once taken");
  });
});

/** The six tiles the contract scans around (1000, 1000) at spacing 4 in a Single game: six out, then three round. */
const SCAN_TILES = [
  [1005, 997],
  [1005, 1003],
  [1000, 1006],
  [996, 1003],
  [996, 997],
  [1000, 994],
] as const;

/**
 * Game 54 with the multiplier rule on, spacing 4, a Hyperstructure at (1000, 1000) and realms at the given tiles; with
 * `held`, a player holds it under a share allocation struck at that multiplier.
 */
const rateIn = (realms: (readonly [number, number])[], held?: { multiplier: number }) => {
  const store = new NativeFactStore();
  const write = (model: string, keys: number[], value: Record<string, unknown>) =>
    store.applyFacts([{ model, key: hash.computePoseidonHashOnElements(keys), value }]);
  write("SliceRules", [54], {
    ...preset.rules,
    game_id: 54,
    mode_rules: preset.rules.mode_rules | nativeRuleConstants.HYPERSTRUCTURE_MULTIPLIERS,
  });
  write("SettlementRules", [54], {
    game_id: 54,
    registration_start: 1,
    registration_limit: 8,
    spacing: 4,
    mode: "Single",
  });
  const place = (entity: number, category: number, owner: bigint, [col, row]: readonly [number, number]) => {
    write("TileOccupancy", [54, entity], {
      game_id: 54,
      entity_id: entity,
      alt: false,
      col,
      row,
      category,
      is_structure: true,
    });
    write("Structure", [54, entity], {
      game_id: 54,
      entity_id: entity,
      owner,
      base: {
        category,
        level: 0,
        created_at: 0,
        troop_max_guard_count: 4,
        troop_max_explorer_count: 0,
        starting_troops_granted: true,
      },
      metadata: { realm_id: 0, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, deepest_depth: 0 },
      resources_packed: 0n,
    });
  };
  place(1, StructureType.Hyperstructure, held ? 0xc1n : 0n, [1000, 1000]);
  realms.forEach((tile, index) => place(10 + index, StructureType.Realm, 0xa1n, tile));
  if (held) {
    write("HyperstructureShares", [54, 1], {
      game_id: 54,
      entity_id: 1,
      start_at: 1n,
      multiplier: held.multiplier,
      shareholders: [{ player: 0xc1n, bps: 10_000 }],
    });
  }
  configManager.setActiveGame(54, 3);
  configManager.setStore(store);
  return getHyperstructureRates(store).get(1);
};

describe("the multiplier a Hyperstructure would be taken at", () => {
  it("counts the realms on the contract's six scan tiles, and no realm off them however near", () => {
    expect(rateIn([SCAN_TILES[0], SCAN_TILES[3], [1001, 1000], [1003, 1002]])).toEqual({
      pointsPerSecond: 2,
      taken: false,
    });
    expect(rateIn([...SCAN_TILES])?.pointsPerSecond).toBe(6);
  });

  it("pays a held one the multiplier its allocation holds: zero, with realms on every scan tile", () => {
    expect(rateIn([...SCAN_TILES], { multiplier: 0 })).toEqual({ pointsPerSecond: 0, taken: true });
  });
});
