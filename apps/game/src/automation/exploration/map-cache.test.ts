import { beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { hash } from "starknet";
import preset from "../../../../../contracts/l3/world-native/fixtures/preset-3.json";
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
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: hash.computePoseidonHashOnElements([1]),
            models: { SliceRules: { ...preset.rules, game_id: 1, map_center_offset: 0 } },
          },
        ],
      },
    ]);
    configManager.setStore(store);
    const write = (model: string, id: number, row: Record<string, unknown>) =>
      store.applyEntityOperations([
        {
          type: "upsert",
          entities: [
            {
              hashed_keys: hash.computePoseidonHashOnElements([1, id]),
              models: { [model]: { game_id: 1, ...row } },
            },
          ],
        },
      ]);
    const base = {
      category: 1,
      level: 0,
      created_at: 0,
      coord_x: 0,
      coord_y: 0,
      alt,
      troop_explorer_count: 0,
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
        troop_explorers: [],
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
    for (const id of [1, armyId])
      write("ExplorerTroops", id, {
        ...explorerFixture.expected.value,
        explorer_id: id,
        owner: explorerOwnerStructureId,
        coord: { alt, x: 10, y: 10 },
      });
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
    expect(snapshot?.structureHexes.get(10)?.get(11)?.owner).toBe(structureOwner);
    expect(snapshot?.armyHexes.get(11)?.get(10)?.owner).toBe(armyOwner);
    expect(snapshot?.exploredTiles.get(10)?.get(10)).toBe(1);
  });
});
