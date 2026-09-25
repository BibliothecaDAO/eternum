import { beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";

import { buildExplorationSnapshot } from "./map-cache";

describe("buildExplorationSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configManager.setActiveGame(1, 1);
  });

  it.each([false, true])("builds the automation view on the exploring army layer (alt=%s)", async (alt) => {
    const explorerOwnerStructureId = 2001;
    const structureId = 201;
    const armyId = 301;
    const structureOwner = 0xabcden;
    const armyOwner = 0x98765n;
    const store = new NativeFactStore();
    store.applyFacts([
      {
        model: "SliceRules",
        key: hash.computePoseidonHashOnElements([1]),
        value: { ...preset.rules, game_id: 1, map_center_offset: 0 },
      },
    ]);
    configManager.setStore(store);
    const write = (model: string, id: number, row: Record<string, unknown>) =>
      store.applyFacts([
        { model: model, key: hash.computePoseidonHashOnElements([1, id]), value: { game_id: 1, ...row } },
      ]);
    const base = {
      category: 1,
      level: 0,
      created_at: 0,
      troop_max_guard_count: 1,
      troop_max_explorer_count: 1,
      starting_troops_granted: false,
    };
    for (const [id, owner] of [
      [structureId, structureOwner],
      [explorerOwnerStructureId, armyOwner],
    ] as const) {
      write("Structure", id, {
        entity_id: id,
        owner,
        base,
        resources_packed: "0",
        metadata: {
          realm_id: id,
          order: 0,
          has_wonder: false,
          village_realm: 0,
          mine_kind: 0,
          attunement: 0,
          barracks_tier: 0,
        },
      });
    }
    for (const id of [1, armyId]) {
      write("ExplorerTroops", id, {
        ...explorerFixture.expected.value,
        explorer_id: id,
        owner: explorerOwnerStructureId,
      });
      write("TileOccupancy", id, {
        alt,
        col: id === 1 ? 10 : 11,
        row: 10,
        entity_id: id,
        category: 15,
        is_structure: false,
      });
    }
    const worldSpatialProjection = {
      getTilesInBounds: vi.fn(() => [
        {
          hexCoords: { alt, col: 10, row: 10 },
          biome: 1,
          occupierId: 0,
          occupierType: 0,
        },
      ]),
      getStructuresInBounds: vi.fn(() => [{ entityId: structureId, hexCoords: { alt, col: 10, row: 11 } }]),
      getArmiesInBounds: vi.fn(() => [{ entityId: armyId, hexCoords: { alt, col: 11, row: 10 } }]),
    };

    const snapshot = await buildExplorationSnapshot({
      store,
      explorerId: 1,
      scopeRadius: 1,
      worldSpatialProjection: worldSpatialProjection as never,
    });

    expect(snapshot?.alt).toBe(alt);
    for (const query of [
      worldSpatialProjection.getTilesInBounds,
      worldSpatialProjection.getStructuresInBounds,
      worldSpatialProjection.getArmiesInBounds,
    ])
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ alt }));
    // The projection carries contract hexes; the snapshot keys them by normalized hex (contract minus the map centre).
    const center = configManager.getMapCenter();
    expect(snapshot?.structureHexes.get(10 - center)?.get(11 - center)?.owner).toBe(structureOwner);
    expect(snapshot?.armyHexes.get(11 - center)?.get(10 - center)?.owner).toBe(armyOwner);
    expect(snapshot?.exploredTiles.get(10 - center)?.get(10 - center)).toBe(1);
  });
});
