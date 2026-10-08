import { expect, it } from "bun:test";
import { ResourceManager, type GameClient } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import preset from "../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { waitForWheatState } from "./frontier";

function realm() {
  const store = new NativeFactStore();
  const values: Record<string, Record<string, unknown>> = {
    SliceRules: { ...preset.rules, game_id: 1, epoch_seconds: 86_400, mode_rules: 0 },
    GameRegistry: {
      game_id: 1,
      name: 1n,
      preset_id: 5,
      creator: 1n,
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: 0n,
      start_main_at: 200n,
      end_at: 86_600n,
      end_grace_seconds: 0,
      seed: 1n,
    },
    SettlementRules: { game_id: 1, registration_start: 1, registration_limit: 0, spacing: 100, mode: "Single" },
    PlayerEntry: { game_id: 1, owner: 0x111n, player: 0xaaan },
    Structure: {
      game_id: 1,
      entity_id: 7,
      owner: 0x111n,
      base: {
        category: 1,
        level: 0,
        created_at: 0n,
        troop_max_guard_count: 0,
        troop_max_explorer_count: 0,
        starting_troops_granted: false,
      },
      resources_packed: 0n,
      metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
    },
    ResourceWeight: { game_id: 1, entity_id: 7, capacity: 1000n, weight: 0n },
    ResourceBalance: {
      game_id: 1,
      entity_id: 7,
      resource_type: ResourcesIds.Wheat,
      balance: 900n * BigInt(RESOURCE_PRECISION),
    },
  };
  store.applyFacts(
    Object.entries(values).map(([model, value], index) => ({ model, value, key: `0x${(index + 1).toString(16)}` })),
  );
  const snapshot = (complete: boolean) => store.setSnapshot({ gameId: 1, actor: "0xaaa", complete, timestamp: 350 });
  snapshot(true);
  return { store, snapshot, client: { gameId: 1, setup: { store } } as unknown as GameClient };
}

it("a confirmed charge's deleted wheat balance waits for the scoped snapshot, then reads real zero", async () => {
  const { store, client, snapshot } = realm();
  const manager = new ResourceManager(store, 7, 1);
  expect(manager.current(ResourcesIds.Wheat)?.balance).toBe(900n * BigInt(RESOURCE_PRECISION));
  snapshot(false);
  store.applyFacts([{ model: "ResourceBalance", key: "0x7", value: null }]);
  expect(manager.current(ResourcesIds.Wheat)).toBeUndefined();
  let settled = false;
  const state = waitForWheatState(client, 7, 1000).then((value) => {
    settled = true;
    return value;
  });
  await Bun.sleep(5);
  expect(settled).toBe(false);
  snapshot(true);
  expect((await state).balance).toBe(0n);
});

it("a shard that never completes wheat synchronization fails with its state, not an invented zero", async () => {
  const { client, snapshot } = realm();
  snapshot(false);
  await expect(waitForWheatState(client, 7, 10)).rejects.toThrow("wheat=unknown");
});
