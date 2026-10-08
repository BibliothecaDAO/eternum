import { expect, it, spyOn, afterEach } from "bun:test";
import { deriveGameSyncScope, scopeInputKeys, rowInGameSyncScope } from "@bibliothecadao/eternum/game-sync-models";
import { expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import type { GameClient } from "@bibliothecadao/eternum";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { resolveFrontierSiteCapture } from "./frontier";

const definition = buildNativePreset(loadNativePresetConfiguration("madara.frontier", 101), 101);
const inputs: Record<string, Record<string, unknown>> = {
  SliceRules: { ...definition.rules, game_id: 1 },
  GameRegistry: { start_main_at: 7200, seed: 1n },
  SettlementRules: { spacing: 100 },
};
const calendar = readExpeditionRules((model) => inputs[model], 1)!;
const first = expeditionRealmSite(calendar, 1, 7200)!;
let timestamp = 7200;
while (expeditionRealmSite(calendar, 1, timestamp)!.row === first.row) timestamp += 60;
const home = expeditionRealmSite(calendar, 1, timestamp)!;
const site = { game_id: 1, entity_id: 3, owner: 0n, base: { category: 7 }, metadata: { realm_id: 0 } };
const rows = [
  { model: "PlayerEntry", value: { owner: "10", player: "11" } },
  { model: "Structure", value: { entity_id: "1", owner: "10", base: { category: 1 }, metadata: { realm_id: 1 } } },
  { model: "Structure", value: site },
  { model: "ExplorerTroops", value: { explorer_id: "2", owner: "1", troops: { count: "1" } } },
  {
    model: "TileOccupancy",
    value: { entity_id: "2", alt: false, col: home.col, row: home.row + 200, category: 15, is_structure: false },
  },
  {
    model: "TileOccupancy",
    value: { entity_id: "3", alt: false, col: home.col + 1, row: home.row + 200, category: 7, is_structure: true },
  },
];
function scope(alive: boolean) {
  return deriveGameSyncScope("0xb", timestamp, calendar, (model, spacing, keys) =>
    rows.filter(
      (row) =>
        row.model === model &&
        (alive || model !== "ExplorerTroops") &&
        scopeInputKeys(model, row.value, spacing).some((key) => keys.includes(key)),
    ),
  );
}
function client(inScope = false, visible?: typeof site) {
  return {
    gameId: 1,
    shard: { url: "https://herald.test" },
    setup: {
      store: {
        get: () => visible,
        subscriptionScope: () => ({ known: inScope ? scope(true) : scope(false) }),
        subscribe: () => () => {},
      },
    },
  } as unknown as GameClient;
}
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
afterEach(() => fetchSpy?.mockRestore());
const history = (items: object[], complete = 50) => {
  fetchSpy?.mockRestore();
  fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ items, total: items.length, complete_through_block: complete }),
  );
};

it("after the first rollover an army defeat drops a deep site from its actor scope, while the fold keeps it", async () => {
  expect(home.row).toBeGreaterThan(first.row);
  expect(rowInGameSyncScope("Structure", site, scope(true))).toBe(true);
  expect(rowInGameSyncScope("Structure", site, scope(false))).toBe(false);
  expect(rowInGameSyncScope("Structure", rows[1]!.value, scope(false))).toBe(true);
  expect(rows.find((row) => row.model === "Structure" && row.value === site)).toBeDefined();
  history([]);
  expect(await resolveFrontierSiteCapture(client(), 3, "0xa", "0x123", 50)).toBe(false);
});

it("an off-scope captured site is classified from this transaction's immutable history", async () => {
  history([
    { transaction_hash: "0x123", value: { owner: "0xa", story: { StructureCapturedStory: { new_owner: "0xa" } } } },
  ]);
  expect(await resolveFrontierSiteCapture(client(), 3, "0xa", "0x123", 50)).toBe(true);
  history([
    { transaction_hash: "0x456", value: { owner: "0xa", story: { StructureCapturedStory: { new_owner: "0xa" } } } },
  ]);
  expect(await resolveFrontierSiteCapture(client(), 3, "0xa", "0x123", 50)).toBe(false);
});

it("refuses an in-scope missing site or incomplete history instead of guessing a battle outcome", async () => {
  await expect(resolveFrontierSiteCapture(client(true), 3, "0xa", "0x123", 50)).rejects.toThrow("completed scope");
  history([], 49);
  await expect(resolveFrontierSiteCapture(client(), 3, "0xa", "0x123", 50)).rejects.toThrow("history is incomplete");
});

it("a still-visible site uses its synchronized owner without extra history reads", async () => {
  history([]);
  expect(await resolveFrontierSiteCapture(client(true, { ...site, owner: 10n }), 3, "0xa", "0x123", 50)).toBe(true);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("waits for the replacement snapshot before inspecting a target or its immutable history", async () => {
  const value = client(true);
  let complete = false;
  let notify = () => {};
  value.setup.store.subscriptionScope = () => (complete ? { known: scope(true) } : { unknown: "INCOMPLETE_SNAPSHOT" });
  value.setup.store.subscribe = (listener) => {
    notify = () => listener([]);
    return () => {};
  };
  value.setup.store.get = (() => (complete ? { ...site, owner: 10n } : undefined)) as typeof value.setup.store.get;
  history([]);
  let settled = false;
  const result = resolveFrontierSiteCapture(value, 3, "0xa", "0x123", 50).then((value) => {
    settled = true;
    return value;
  });
  await Bun.sleep(1);
  expect(settled).toBe(false);
  expect(fetchSpy).not.toHaveBeenCalled();
  complete = true;
  notify();
  expect(await result).toBe(true);
  expect(fetchSpy).not.toHaveBeenCalled();
});
