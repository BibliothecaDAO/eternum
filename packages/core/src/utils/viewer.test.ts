import { beforeEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { NativeFactStore } from "../client/native-fact-store";
import explorerFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
// The package index first, so the config singleton the utils read through it is evaluated before any view runs.
import { configManager, formatArmies, getStructure } from "..";

vi.stubGlobal("localStorage", { getItem: () => null });
beforeEach(() => {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(2147483647);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
});

const PLAYER = 0x123n;
const BANDITS = 0n;

// A player's realm and a bandit camp, each with an army at home.
const buildStore = () => {
  const store = new NativeFactStore();
  const write = (model: string, id: number, value: Record<string, unknown>) =>
    store.applyFacts([{ model, key: hash.computePoseidonHashOnElements([1, id]), value }]);
  for (const [id, owner] of [
    [1, PLAYER],
    [2, BANDITS],
  ] as const) {
    for (const entity of [id, 10 + id])
      write("TileOccupancy", entity, {
        game_id: 1,
        entity_id: entity,
        alt: false,
        col: 2147483650 + entity * 10,
        row: 2147483660,
        category: entity === id ? 1 : 15,
        is_structure: entity === id,
      });
    write("Structure", id, {
      game_id: 1,
      entity_id: id,
      owner,
      base: {
        category: 1,
        level: 0,
        created_at: 0,
        troop_max_guard_count: 4,
        troop_max_explorer_count: 4,
        starting_troops_granted: true,
      },
      metadata: {
        realm_id: id,
        order: 0,
        has_wonder: false,
        village_realm: 0,
        mine_kind: 0,
        attunement: 0,
        barracks_tier: 0,
      },
      resources_packed: 0n,
    });
    write("ExplorerTroops", 10 + id, {
      ...explorerFixture.expected.value,
      game_id: 1,
      explorer_id: 10 + id,
      owner: id,
    });
  }
  return store;
};

const mine = (store: NativeFactStore, viewer: bigint | null) => ({
  armies: formatArmies(store.inGame("ExplorerTroops", 1), viewer, store, () => undefined)
    .filter((army) => army.isMine)
    .map((army) => army.entityId),
  structures: [1, 2].filter((id) => getStructure(id, viewer, store, () => undefined)?.isMine),
});

it("gives a spectator no bandit rows, while a signed-in viewer still owns their own", () => {
  const store = buildStore();
  expect(mine(store, 0n)).toEqual({ armies: [], structures: [] });
  expect(mine(store, null)).toEqual({ armies: [], structures: [] });
  expect(mine(store, PLAYER)).toEqual({ armies: [11], structures: [1] });
});
