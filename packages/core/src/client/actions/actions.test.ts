// @vitest-environment node

import { BUILDINGS_CENTER, BuildingType, getNeighborHexes, type SystemCalls } from "@bibliothecadao/types";
import { NativeFactStore } from "../native-fact-store";
import preset from "../../../../../contracts/l3/world-native/fixtures/preset-1.json";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { hash } from "starknet";
import type { AccountInterface } from "starknet";
import { describe, expect, it, vi } from "vitest";

// Through the barrel, as the app loads core: the managers resolve their cross-imports off it.
import { ActionType, ArmyActionManager, ClientConfigManager, createGameActions, createGameViews } from "../../index";
import type { GameClient } from "../game-client";

const GAME_ID = 28;
const EXPLORER_ID = 101;
const STRUCTURE_ID = 12;
const SIGNER = { address: "0xabc" } as AccountInterface;

describe("game actions", () => {
  it("moveArmy dispatches the same explorer_travel call the manager does", async () => {
    const { store, systemCalls, client } = createHarness(SIGNER);
    const path = seedExplorerWithTravelPath(store);

    await client.actions.moveArmy({ explorerId: EXPLORER_ID, path, currentArmiesTick: 7 });
    await new ArmyActionManager(store, systemCalls, EXPLORER_ID).moveArmy(SIGNER, path, true, 7);

    expect(systemCalls.explorer_travel).toHaveBeenCalledTimes(2);
    const [throughActions, throughManager] = vi.mocked(systemCalls.explorer_travel).mock.calls;
    expect(throughActions).toEqual(throughManager);
    expect(throughActions?.[0]).toEqual({ signer: SIGNER, explorer_id: EXPLORER_ID, directions: [expect.any(Number)] });
  });

  it("placeBuilding submits for the structure's own hex", async () => {
    const { store, systemCalls, client } = createHarness(SIGNER);
    seedStructure(store, { x: 40, y: 50 });
    const hex = { col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1] };

    await client.actions.placeBuilding({
      structureId: STRUCTURE_ID,
      buildingType: BuildingType.ResourceWheat,
      hex,
      useSimpleCost: true,
    });

    expect(systemCalls.create_building).toHaveBeenCalledWith({
      signer: SIGNER,
      entity_id: STRUCTURE_ID,
      directions: [expect.any(Number)],
      building_category: BuildingType.ResourceWheat,
      use_simple: true,
    });
    expect(client.views.buildingTiles(STRUCTURE_ID).getHexCoords()).toEqual({ col: 40, row: 50 });
  });

  it("names a structure that is not in the native store instead of acting on a default hex", () => {
    const { client } = createHarness(SIGNER);

    expect(() => client.views.buildingTiles(STRUCTURE_ID)).toThrow("Native Structure is not synchronized");
  });

  it("acts for a named signer over a client that never connected", async () => {
    const { store, systemCalls, client } = createHarness(null);
    const path = seedExplorerWithTravelPath(store);
    const bot = { address: "0xb07" } as AccountInterface;

    await createGameActions(client, { signer: bot }).moveArmy({ explorerId: EXPLORER_ID, path, currentArmiesTick: 7 });

    expect(systemCalls.explorer_travel).toHaveBeenCalledWith(expect.objectContaining({ signer: bot }));
    expect(client.signer).toBeNull();
  });

  it("refuses to submit before connect(signer)", async () => {
    const { store, systemCalls, client } = createHarness(null);
    const path = seedExplorerWithTravelPath(store);

    await expect(client.actions.moveArmy({ explorerId: EXPLORER_ID, path, currentArmiesTick: 7 })).rejects.toThrow(
      "call client.connect(signer)",
    );
    expect(systemCalls.explorer_travel).not.toHaveBeenCalled();
  });
});

const createHarness = (signer: AccountInterface | null) => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 0);
  const store = new NativeFactStore();
  write(store, "SliceRules", [GAME_ID], { ...preset.rules, game_id: GAME_ID, map_center_offset: 2147483646 });
  ClientConfigManager.instance().setStore(store);
  const systemCalls = {
    explorer_travel: vi.fn(async () => ({ transaction_hash: "0x1" })),
    create_building: vi.fn(async () => ({ transaction_hash: "0x2" })),
  } as unknown as SystemCalls;
  // createGameClient wires these the same way; the harness skips the network boot.
  const client = { setup: { store, systemCalls }, signer } as GameClient;
  Object.assign(client, { actions: createGameActions(client), views: createGameViews(client, 0n) });
  return { store, systemCalls, client };
};

/** An explorer at (20, 20) with one explored neighbor, and the two-step Move path to it. */
const seedExplorerWithTravelPath = (store: NativeFactStore) => {
  const start = { col: 20, row: 20 };
  const destination = getNeighborHexes(start.col, start.row)[0];
  write(store, "ExplorerTroops", [GAME_ID, EXPLORER_ID], {
    ...explorerFixture.expected.value,
    game_id: GAME_ID,
    explorer_id: EXPLORER_ID,
    owner: STRUCTURE_ID,
    coord: { x: start.col, y: start.row, alt: false },
  });
  return [
    { hex: start, actionType: ActionType.Move },
    { hex: { col: destination.col, row: destination.row }, actionType: ActionType.Move },
  ];
};

const seedStructure = (store: NativeFactStore, position: { x: number; y: number }) =>
  write(store, "Structure", [GAME_ID, STRUCTURE_ID], {
    game_id: GAME_ID,
    entity_id: STRUCTURE_ID,
    owner: 0xabcn,
    base: {
      coord_x: position.x,
      coord_y: position.y,
      alt: false,
      level: 1,
      category: 1,
      troop_explorer_count: 0,
      troop_max_explorer_count: 2,
      troop_max_guard_count: 1,
      created_at: 0,
      starting_troops_granted: true,
    },
    metadata: { realm_id: 1, order: 1, has_wonder: false, village_realm: 0, mine_kind: 0 },
    troop_explorers: [],
    resources_packed: 0n,
  });

function write(store: NativeFactStore, model: string, keys: number[], value: Record<string, unknown>) {
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [
        {
          hashed_keys: hash.computePoseidonHashOnElements(keys),
          models: { [model]: value },
        },
      ],
    },
  ]);
}
