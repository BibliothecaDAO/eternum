import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createServer } from "vite";

const app = fileURLToPath(new URL("..", import.meta.url));
const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
const mod = await server.ssrLoadModule(join(app, "docs/utils/dashboard-data.ts"));
const { ASPECT_HEX } = await server.ssrLoadModule(join(app, "../game/src/tokens.ts"));
await server.close();

const devRelease = JSON.parse(readFileSync(join(app, "../../deploy/release/dev.json"), "utf8"));
const productionRelease = JSON.parse(readFileSync(join(app, "../../deploy/release/production.json"), "utf8"));
const environments = JSON.parse(readFileSync(join(app, "../../deploy/first/environments.json"), "utf8"));

const {
  DASHBOARD_CACHE_TTL_MS,
  DASHBOARD_CONFIG,
  aggregateActivityByDay,
  aggregateRealmsByUtcDay,
  dashboardOriginsFor,
  formatShortAddress,
  loadDashboardData,
  pickDefaultGame,
  readCachedDashboard,
  summarizeSnapshot,
  writeCachedDashboard,
} = mod;

test("dashboardOriginsFor resolves dev and production origins and derives Aspect colours from ASPECT_HEX", () => {
  assert.deepEqual(dashboardOriginsFor("production"), {
    heraldUrl: productionRelease.public_herald_url,
    rpcUrl: productionRelease.public_rpc_url,
    identityOrigin: environments.production.origin,
  });
  for (const env of ["staging", undefined]) {
    assert.deepEqual(dashboardOriginsFor(env), {
      heraldUrl: devRelease.public_herald_url,
      rpcUrl: devRelease.public_rpc_url,
      identityOrigin: environments.dev.origin,
    });
  }
  for (const aspect of DASHBOARD_CONFIG.aspects) {
    assert.equal(aspect.color, ASPECT_HEX[aspect.id]);
  }
});

test("pickDefaultGame prefers Season 1 over testnet and falls back to active testnet", () => {
  const testnet = { game_id: 1, name: "testnet-1795521600", status: "Live" };
  const season = { game_id: 2, name: "frontier-1796212800", status: "Registration" };
  assert.equal(pickDefaultGame([testnet]).game_id, 1);
  assert.equal(pickDefaultGame([testnet, season]).game_id, 2);
  assert.equal(pickDefaultGame([]), null);
});

test("1-hour dashboard cache returns fresh entries and expires at TTL", () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const payload = { fetchedAt: 1_000_000, gameId: 1 };
  writeCachedDashboard(storage, 1, payload);
  assert.deepEqual(readCachedDashboard(storage, 1, 1_000_000 + DASHBOARD_CACHE_TTL_MS - 1), payload);
  assert.equal(readCachedDashboard(storage, 1, 1_000_000 + DASHBOARD_CACHE_TTL_MS), null);
});

test("activity and realm history aggregate by Frontier day and UTC day", () => {
  const activity = aggregateActivityByDay([
    { value: { day: "0x0", active: "0x5" } },
    { value: { day: "0x0", active: "0x3" } },
    { value: { day: "0x1", active: "0xa" } },
  ]);
  assert.deepEqual(activity, [
    { key: "0", label: "Day 1", value: 8 },
    { key: "1", label: "Day 2", value: 10 },
  ]);

  const realms = aggregateRealmsByUtcDay([
    { value: { timestamp: "0x6b057cca" } },
    { value: { timestamp: "0x6b057ccb" } },
  ]);
  assert.equal(realms.length, 1);
  assert.equal(realms[0].key, "2026-11-24");
  assert.equal(realms[0].value, 2);
});

test("summarizeSnapshot counts armies, Deep sites, Seals, and active World Banes", () => {
  const summary = summarizeSnapshot(
    [
      { model: "AspectActivity", rows: [{ key: "1", value: { day: "0x1", active: "0x4" } }] },
      {
        model: "ExplorerTroops",
        rows: [
          { key: "1", value: {} },
          { key: "2", value: {} },
          { key: "3", value: {} },
        ],
      },
      { model: "DeepArmy", rows: [{ key: "1", value: {} }] },
      {
        model: "DeepSite",
        rows: [
          { key: "1", value: {} },
          { key: "2", value: {} },
        ],
      },
      { model: "Seal", rows: [{ key: "1", value: {} }] },
      { model: "WorldBane", rows: [{ key: "1", value: { day: "0x1", kind: "0x1" } }] },
    ],
    1,
  );
  assert.equal(summary.totalArmies, 3);
  assert.equal(summary.deepArmies, 1);
  assert.equal(summary.expeditionArmies, 2);
  assert.equal(summary.deepSites, 2);
  assert.equal(summary.seals, 1);
  assert.equal(summary.activeWorldBanes, 1);
  assert.equal(summary.activeToday, 4);
});

test("loadDashboardData combines Herald, stats, accounts, profiles, and RPC with graceful fallbacks", async () => {
  const game = {
    game_id: 1,
    name: "testnet-1795521600",
    mode: "frontier",
    status: "Live",
    day_index: 0,
    player_count: 2,
    settled_realms_count: 2,
    aspect_members: { 1: 1, 2: 1, 3: 0, 4: 0 },
    aspect_race: { finish_height: 10000, season_days: 50, heights: { 1: 200, 2: 0, 3: 0, 4: 0 } },
  };
  const owner = "0x57b9e20b749d8fa23967c0621bccd56ad781984f6620b08a25cda35acb4340";
  const fetcher = async (url) => {
    if (url.endsWith("/games/1/stats")) {
      return {
        ok: true,
        json: async () => ({
          game_id: "1",
          players: 2,
          realms: 2,
          transactions: { total: 42, days: [{ day: "2026-11-24", transactions: 42 }] },
        }),
      };
    }
    if (url.endsWith("/api/stats/accounts")) {
      return { ok: true, json: async () => ({ accounts: 99 }) };
    }
    if (url.includes("/api/profiles")) {
      return { ok: true, json: async () => ({ profiles: { [owner]: { name: "Nexonik" } } }) };
    }
    if (url.includes("/snapshot?")) {
      return { ok: true, json: async () => ({ confirmed_block: 500, models: [] }) };
    }
    if (url.includes("/aspects/1/members")) {
      return {
        ok: true,
        json: async () => ({ members: [{ rank: 1, entity_id: "1", realm_id: 2077, owner, glory: "150" }] }),
      };
    }
    if (url.includes("/aspects/")) {
      return { ok: true, json: async () => ({ members: [] }) };
    }
    if (url.includes("model=BattleEvent")) {
      return { ok: true, json: async () => ({ total: 11, items: [] }) };
    }
    if (url.includes("story=ExplorationReward")) {
      return { ok: true, json: async () => ({ total: 17, items: [] }) };
    }
    if (url.includes("/history?")) {
      return { ok: true, json: async () => ({ total: 5, items: [] }) };
    }
    return { ok: true, json: async () => ({ result: { block_number: 501, transactions: ["0x1"] } }) };
  };

  const result = await loadDashboardData(game, 499, fetcher, 123456);
  assert.equal(result.confirmedBlock, 500);
  assert.equal(result.latestBlock, 501);
  assert.equal(result.latestBlockTxs, 1);
  assert.equal(result.signedInAccounts, 99);
  assert.equal(result.playerActionsTotal, 42);
  assert.equal(result.battles, 11);
  assert.equal(result.tilesExplored, 17);
  assert.equal(result.actionsByUtcDay[0].value, 42);
  assert.equal(result.topGlory[0].displayName, "Nexonik");
  assert.equal(formatShortAddress(owner), "0x57b9…4340");
});
