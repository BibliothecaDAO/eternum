import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import preset from "../../../contracts/l3/world-native/fixtures/preset-3.json";
import explorerFixture from "../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { realmsIdOf } from "./realms-id";

/**
 * The shard notifier runs as it does on Cloudflare: the bundled Worker with its Durable Object, alarms and D1 in
 * workerd. Only the network is faked: one shard's Herald and one push service.
 */
const SHARD = "https://shard-a.test";
const CHAIN_ID = "0xa";
const GAME_ID = 1;
const PLAYER_ACCOUNT = "0x4b1d";
const HOME = 5;
const ARMY = 7;
const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/player-device";
const DEVICE_ID = "00000000-0000-4000-8000-000000000001";
const OWNER = realmsIdOf("player-one");
/**
 * A two-second armies tick with the preset's knights (120, regaining 20 a tick): six ticks from empty to rested, long
 * enough that the notifier, polling every three seconds, sees an army act again well before its first wake time.
 */
const ARMIES_TICK_SECONDS = 2;
/** A Frontier season that began yesterday: today is its second daily expedition, each day a row of 40-hex regions. */
const DAY_SECONDS = 86_400;
const REGION_SPACING = 40;
const SEASON_START = (Math.floor(Date.now() / 1000 / DAY_SECONDS) - 1) * DAY_SECONDS;
const TODAY = 1;

let bundle: string;
const roots: string[] = [];

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "shard-notifier-bundle-"));
  roots.push(root);
  bundle = join(root, "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
}, 180_000);

afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitUntil = async (condition: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) await pause(250);
};
const base64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes as ArrayBuffer).toString("base64url");
const armiesTick = () => Math.floor(Date.now() / 1000 / ARMIES_TICK_SECONDS);

interface HistoryRow {
  block_number: number;
  transaction_index: number;
  event_index: number;
  model: string;
  value: object;
}

/** One shard's Herald: a history log that grows, and the player's army as its snapshot shows it now. */
const createHerald = () => {
  const log: HistoryRow[] = [];
  const state = { army: null as null | { amount: number; updatedTick: number; day: number } };
  const answer = (url: URL): unknown => {
    if (url.pathname === "/manifest") return { version: 1, chainId: CHAIN_ID, contracts: { season: "0x5e45" } };
    if (url.pathname === "/games") return { chain: CHAIN_ID, games: [{ game_id: GAME_ID, name: "frontier-a" }] };
    if (url.pathname === `/games/${GAME_ID}/snapshot`) return snapshot(state.army);
    const page = { chain: CHAIN_ID, world_address: "0x5e45", complete_through_block: 10 + log.length };
    const after = url.searchParams.get("after");
    if (!after) return { ...page, next_cursor: { block: 10, transaction: 2147483647, event: 2147483647 }, items: [] };
    const [block, transaction, event] = after.split(":").map(Number);
    const items = log.filter((row) => row.block_number > block!);
    const last = items.at(-1);
    return {
      ...page,
      next_cursor: last
        ? { block: last.block_number, transaction: last.transaction_index, event: last.event_index }
        : { block, transaction, event },
      items: items.map((row) => ({ ...row, game_id: String(GAME_ID), transaction_hash: `0x${row.block_number}` })),
    };
  };
  const append = (model: string, eventIndex: number, value: object) =>
    log.push({ block_number: 11 + log.length, transaction_index: 0, event_index: eventIndex, model, value });
  /** The player acts: a recorded execution on the next block, their army's stamina spent at this tick. */
  const act = (stamina: number, day = TODAY) => {
    state.army = { amount: stamina, updatedTick: armiesTick(), day };
    append("ExecutionRecorded", 1, {
      game_id: GAME_ID,
      actor: PLAYER_ACCOUNT,
      nonce: log.length,
      nonce_consumed: true,
      order: log.length,
      status: 1,
      reason: 0,
    });
  };
  const battle = () =>
    append("BattleEvent", 3, {
      game_id: GAME_ID,
      attacker_id: ARMY,
      defender_id: 9,
      winner_id: ARMY,
      attacker: { player: PLAYER_ACCOUNT },
      defender: { player: "0x0" },
      timestamp: Math.floor(Date.now() / 1000),
    });
  return { answer, act, battle, state };
};

/** The game's rules with a short armies tick, the player's home realm, and their army if it still exists. */
const snapshot = (army: null | { amount: number; updatedTick: number; day: number }) => ({
  confirmed_block: 10,
  game_id: String(GAME_ID),
  models: [
    {
      model: "SliceRules",
      rows: [
        {
          key: "0x1",
          value: {
            ...preset.rules,
            game_id: GAME_ID,
            tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: ARMIES_TICK_SECONDS },
            epoch_seconds: DAY_SECONDS,
          },
        },
      ],
    },
    {
      model: "SettlementRules",
      rows: [
        {
          key: "0x4",
          value: {
            game_id: GAME_ID,
            registration_start: 0,
            registration_limit: 0,
            mode: "Single",
            spacing: REGION_SPACING,
          },
        },
      ],
    },
    {
      model: "GameRegistry",
      rows: [
        {
          key: "0x5",
          value: {
            game_id: GAME_ID,
            name: "0x1",
            preset_id: 1,
            creator: "0x1",
            settled: false,
            ready: true,
            dev_mode_on: false,
            start_settling_at: SEASON_START,
            start_main_at: SEASON_START,
            end_at: SEASON_START + 30 * DAY_SECONDS,
            end_grace_seconds: 0,
            seed: "0x1",
          },
        },
      ],
    },
    { model: "Structure", rows: [{ key: "0x2", value: homeStructure }] },
    {
      model: "ExplorerTroops",
      rows: army
        ? [
            {
              key: "0x3",
              value: {
                ...explorerFixture.expected.value,
                game_id: GAME_ID,
                explorer_id: ARMY,
                owner: HOME,
                // An army stands in the region of the day it marched out on.
                coord: { x: REGION_SPACING / 2, y: army.day * 4 * REGION_SPACING + REGION_SPACING / 2, alt: false },
                troops: {
                  ...explorerFixture.expected.value.troops,
                  count: "0x64",
                  stamina: { amount: army.amount, updated_tick: army.updatedTick },
                },
              },
            },
          ]
        : [],
    },
  ],
});

const homeStructure = {
  game_id: GAME_ID,
  entity_id: HOME,
  owner: PLAYER_ACCOUNT,
  base: {
    coord_x: 12,
    coord_y: 34,
    alt: false,
    level: 1,
    category: 1,
    troop_explorer_count: 1,
    troop_max_explorer_count: 2,
    troop_max_guard_count: 0,
    created_at: 0,
    starting_troops_granted: true,
  },
  metadata: {
    realm_id: 1,
    order: 1,
    has_wonder: false,
    village_realm: 0,
    mine_kind: 0,
    attunement: 0,
    barracks_tier: 0,
  },
  troop_explorers: [],
  resources_packed: "0x0",
};

/** The Worker in workerd over storage that survives a restart, a fake Herald, and a push service answering `status`. */
const createHarness = async (level: "important" | "standard") => {
  const root = mkdtempSync(join(tmpdir(), "shard-notifier-"));
  roots.push(root);
  const herald = createHerald();
  const push = { status: 201, received: [] as number[] };
  const vapid = await vapidKeys();
  const start = async () => {
    const mf = new Miniflare({
      modulesRoot: bundle,
      modules: [{ type: "ESModule", path: join(bundle, "worker.js") }],
      compatibilityDate: "2026-07-30",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: { DB: "identity" },
      d1Persist: join(root, "d1"),
      durableObjects: { SHARD_NOTIFIER: { className: "ShardNotifier", useSQLite: true } },
      durableObjectsPersist: join(root, "do"),
      bindings: {
        ENVIRONMENT: "staging",
        BASE_URL: "https://staging.realms.party",
        ACCOUNT_CLASS_HASH: "0x1",
        BETTER_AUTH_SECRET: "notifier-test-secret-notifier-test-secret",
        IDENTITY_RPC_URL: "http://127.0.0.1:1",
        DIRECTORY_ADMIN_TOKEN: "unused",
        WEB_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey,
        WEB_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey,
        WEB_PUSH_VAPID_SUBJECT: "mailto:ops@realms.party",
      },
      outboundService: async (request: Request) => {
        const url = new URL(request.url);
        if (url.origin === SHARD) return Response.json(herald.answer(url));
        if (url.href === PUSH_ENDPOINT) {
          push.received.push(push.status);
          return new Response(null, { status: push.status });
        }
        return new Response("unexpected outbound request", { status: 599 });
      },
    });
    return {
      dispose: () => mf.dispose(),
      runCron: async () => (await mf.getWorker()).scheduled({ cron: "* * * * *" }),
      db: (await mf.getD1Database("DB")) as unknown as D1Database,
    };
  };
  const worker = await start();
  await seed(worker.db, level, await deviceKeys());
  return { herald, push, start, worker };
};

const vapidKeys = async () => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", keys.privateKey)) as JsonWebKey;
  const raw = (await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer;
  return { publicKey: base64url(raw), privateKey: jwk.d! };
};

const deviceKeys = async () => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  return {
    p256dh: base64url((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer),
    auth: base64url(crypto.getRandomValues(new Uint8Array(16))),
  };
};

/** The player's account, level, opted-in device and the shard, as sign-in, /devices, settings and the operator leave them. */
const seed = async (db: D1Database, level: string, device: { p256dh: string; auth: string }) => {
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join(";\n")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const now = Date.now();
  await db.batch([
    ...statements.map((statement) => db.prepare(statement)),
    db
      .prepare(
        `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "realmsId") VALUES ('player-one', 'player-one', 'p@x.test', 0, ?, ?, ?)`,
      )
      .bind(new Date(now).toISOString(), new Date(now).toISOString(), OWNER),
    db.prepare(`INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)`).bind(PLAYER_ACCOUNT, OWNER),
    db
      .prepare(`INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, ?, 1)`)
      .bind(OWNER, level),
    db
      .prepare(
        `INSERT INTO "notification_push_subscriptions" ("id", "owner", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt", "createdAt") VALUES (?, ?, ?, ?, ?, 'x', ?, ?)`,
      )
      .bind(DEVICE_ID, OWNER, PUSH_ENDPOINT, device.p256dh, device.auth, now - 60_000, now - 60_000),
    db
      .prepare(`INSERT INTO "shards" ("url", "chainId", "status", "addedAt") VALUES (?, ?, 'active', ?)`)
      .bind(SHARD, CHAIN_ID, now),
  ]);
};

it("alerts the player's device once for a battle on a listed shard, and a restart resends nothing", async () => {
  const { herald, push, start, worker } = await createHarness("important");
  push.status = 503;
  await worker.runCron();
  await pause(4_000); // the notifier reaches the shard's head
  herald.battle();
  await waitUntil(() => push.received.length >= 1, 15_000);
  expect(push.received).toEqual([503]);
  await worker.dispose();

  push.status = 201;
  const restarted = await start();
  await restarted.runCron();
  await waitUntil(() => push.received.includes(201), 20_000);
  await pause(8_000); // two more polls, and the retry window, pass quietly
  expect(push.received).toEqual([503, 201]);
  await restarted.dispose();
}, 90_000);

it("alerts once when an army is rested, not if it acted again first, nor once it is gone or from an earlier day", async () => {
  const { herald, push, worker } = await createHarness("standard");
  await worker.runCron();
  await pause(4_000); // the notifier reaches the shard's head

  herald.act(0);
  await waitUntil(() => push.received.length >= 1, 30_000);
  expect(push.received).toEqual([201]);

  herald.act(0);
  const firstWake = Date.now() + 6 * ARMIES_TICK_SECONDS * 1000;
  await pause(ARMIES_TICK_SECONDS * 1000);
  herald.act(0); // the army spends its stamina again before it was rested
  await waitUntil(() => Date.now() > firstWake + 2_000, 30_000);
  expect(push.received).toEqual([201]);
  await waitUntil(() => push.received.length >= 2, 30_000);
  expect(push.received).toEqual([201, 201]);

  herald.act(0);
  await pause(ARMIES_TICK_SECONDS * 1000);
  herald.state.army = null; // the army expires at rollover before it is rested
  await pause(7 * ARMIES_TICK_SECONDS * 1000 + 4_000);
  expect(push.received).toEqual([201, 201]);

  herald.act(0, TODAY - 1); // an army of yesterday's expedition is still a fact, but no longer an army
  await pause(7 * ARMIES_TICK_SECONDS * 1000 + 4_000);
  expect(push.received).toEqual([201, 201]);
  await worker.dispose();
}, 240_000);
