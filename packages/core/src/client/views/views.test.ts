import { ContractAddress, getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { hash } from "starknet";
import { describe, expect, it } from "vitest";
import { ClientConfigManager, createGameViews, type GameViews } from "../../index";
import { NativeFactStore } from "../native-fact-store";
import type { GameClient } from "../game-client";
import explorerFixture from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";

const GAME_ID = 28;
const PLAYER = ContractAddress(0xabc);
const RIVAL = ContractAddress(0xdef);

describe("game views", () => {
  it("lists a player's structures by category then entity id, seen as theirs", () => {
    const { store, views } = createHarness();
    seedStructure(store, { entityId: 30, owner: PLAYER, category: StructureType.Hyperstructure, x: 5, y: 5 });
    seedStructure(store, { entityId: 20, owner: PLAYER, category: StructureType.Realm, x: 3, y: 3 });
    seedStructure(store, { entityId: 7, owner: RIVAL, category: StructureType.Realm, x: 2, y: 2 });
    seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 1, y: 1 });

    const structures = views.structures(PLAYER);

    expect(structures.map((structure) => structure.entityId)).toEqual([12, 20, 30]);
    expect(structures.every((structure) => structure.isMine)).toBe(true);
    expect(views.structures(RIVAL).map(({ entityId, isMine }) => ({ entityId, isMine }))).toEqual([
      { entityId: 7, isMine: false },
    ]);
    expect(views.allRealms().map((realm) => realm.entity_id)).toEqual([20, 7, 12]);
    expect(views.hyperstructureIds(PLAYER)).toEqual([30]);
  });

  it("reads a structure's explorers with stamina, home, and ownership relative to the viewer", () => {
    const { store, views } = createHarness();
    seedStructure(store, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 10, y: 10 });
    const homeHex = getNeighborHexes(10, 10)[0];
    seedExplorer(store, { explorerId: 101, owner: 12, x: homeHex.col, y: homeHex.row, stamina: 40n });
    seedExplorer(store, { explorerId: 102, owner: 12, x: 50, y: 50, stamina: 5n });
    seedExplorer(store, { explorerId: 103, owner: 99, x: 60, y: 60, stamina: 0n });
    expect(() => views.explorers(99)).toThrow("not synchronized");
    seedStructure(store, { entityId: 99, owner: RIVAL, category: StructureType.Realm, x: 59, y: 60 });

    const explorers = views.explorers(12);

    expect(explorers.map(({ entityId, stamina, isHome, isMine }) => ({ entityId, stamina, isHome, isMine }))).toEqual([
      { entityId: 101, stamina: 40n, isHome: true, isMine: true },
      { entityId: 102, stamina: 5n, isHome: false, isMine: true },
    ]);
    expect(createGameViews(fakeClient(store), RIVAL, () => null).explorers(12)[0]?.isMine).toBe(false);
    expect(views.explorers(99).map((explorer) => explorer.entityId)).toEqual([103]);
    expect(views.explorers(1)).toEqual([]);
  });

  it("hands out a resource manager bound to the entity's native weight row in the active game", () => {
    const { store, views } = createHarness();
    store.applyFacts([
      { model: "ResourceWeight", key: "0xc", value: { game_id: GAME_ID, entity_id: 12, weight: 0n, capacity: 1000n } },
    ]);

    expect(views.resources(12).hasResources()).toBe(true);
    expect(views.resources(13).hasResources()).toBe(false);
  });
});

const createHarness = (): { store: NativeFactStore; views: GameViews } => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 1);
  const store = new NativeFactStore();
  return { store, views: createGameViews(fakeClient(store), PLAYER, () => null) };
};

const fakeClient = (store: NativeFactStore): GameClient => ({ setup: { store } }) as GameClient;

const seedStructure = (
  store: NativeFactStore,
  input: { entityId: number; owner: ContractAddress; category: StructureType; x: number; y: number },
) =>
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: hash.computePoseidonHashOnElements([GAME_ID, 0, input.x, input.y]),
      value: {
        game_id: GAME_ID,
        alt: false,
        col: input.x,
        row: input.y,
        entity_id: input.entityId,
        category: input.category,
        is_structure: true,
      },
    },
    {
      model: "Structure",
      key: `0x${input.entityId.toString(16)}`,
      value: {
        game_id: GAME_ID,
        entity_id: input.entityId,
        owner: input.owner,
        base: {
          category: input.category,
          level: 0,
          created_at: 1,
          troop_max_guard_count: 1,
          troop_max_explorer_count: 1,
          starting_troops_granted: false,
        },
        metadata: {
          realm_id: 1,
          village_realm: 0,
          has_wonder: false,
          order: 0,
          mine_kind: 0,
          attunement: 0,
          barracks_tier: 0,
        },
        resources_packed: 0n,
      },
    },
  ]);

const seedExplorer = (
  store: NativeFactStore,
  input: { explorerId: number; owner: number; x: number; y: number; stamina: bigint },
) =>
  store.applyFacts([
    {
      model: "TileOccupancy",
      key: hash.computePoseidonHashOnElements([GAME_ID, 0, input.x, input.y]),
      value: {
        game_id: GAME_ID,
        alt: false,
        col: input.x,
        row: input.y,
        entity_id: input.explorerId,
        category: 15,
        is_structure: false,
      },
    },
    {
      model: "ExplorerTroops",
      key: `0x${input.explorerId.toString(16)}`,
      value: {
        ...explorerFixture.expected.key,
        ...explorerFixture.expected.value,
        game_id: GAME_ID,
        explorer_id: input.explorerId,
        owner: input.owner,
        troops: {
          ...explorerFixture.expected.value.troops,
          count: 100n,
          stamina: { Inline: { amount: input.stamina, updated_tick: 1n } },
        },
      },
    },
  ]);
