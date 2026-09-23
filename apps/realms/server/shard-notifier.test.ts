import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";

import { realmsIdOf } from "./realms-id";

/**
 * The shard notifier runs as it does on Cloudflare: the bundled Worker with its Durable Object, alarms and D1 in
 * workerd. Only the network is faked: one shard's Herald and one push service.
 */
const SHARD = "https://shard-a.test";
const CHAIN_ID = "0xa";
const PLAYER_ACCOUNT = "0x4b1d";
const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/player-device";
const DEVICE_ID = "00000000-0000-4000-8000-000000000001";
const OWNER = realmsIdOf("player-one");

let root: string;
let bundle: string;
const herald = { publishedBattle: false };
const push = { status: 503, received: [] as number[] };

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "shard-notifier-"));
  bundle = join(root, "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
}, 120_000);

afterAll(() => rmSync(root, { recursive: true, force: true }));

const base64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes as ArrayBuffer).toString("base64url");

const vapidKeys = async () => {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", keys.privateKey)) as JsonWebKey;
  const raw = await crypto.subtle.exportKey("raw", keys.publicKey);
  return { publicKey: base64url(raw as ArrayBuffer), privateKey: jwk.d! };
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

/** The shard's head sits at block 10; the battle, once published, is the one story at block 11. */
const heraldAnswer = (url: URL): unknown => {
  if (url.pathname === "/manifest") return { version: 1, chainId: CHAIN_ID, contracts: { season: "0x5e45" } };
  if (url.pathname === "/games") return { chain: CHAIN_ID, games: [{ game_id: 1, name: "frontier-a" }] };
  const head = { block: 10, transaction: 2147483647, event: 2147483647 };
  const page = { chain: CHAIN_ID, world_address: "0x5e45", complete_through_block: 11 };
  const after = url.searchParams.get("after");
  if (!after || !herald.publishedBattle || Number(after.split(":")[0]) >= 11) {
    return { ...page, next_cursor: after ? parseCursor(after) : head, items: [] };
  }
  return {
    ...page,
    next_cursor: { block: 11, transaction: 0, event: 3 },
    items: [recordedExecution(), battleAgainstThePlayer()],
  };
};

const parseCursor = (value: string) => {
  const [block, transaction, event] = value.split(":").map(Number);
  return { block, transaction, event };
};

/** The cursor also carries events that are not stories; they pass without an alert and without holding it up. */
const recordedExecution = () => ({
  block_number: 11,
  transaction_index: 0,
  event_index: 1,
  game_id: "1",
  model: "ExecutionRecorded",
  transaction_hash: "0xbeef",
  value: { game_id: 1, actor: PLAYER_ACCOUNT, nonce: 4, nonce_consumed: true, order: 12, status: 1, reason: 0 },
});

const battleAgainstThePlayer = () => ({
  block_number: 11,
  transaction_index: 0,
  event_index: 3,
  game_id: "1",
  model: "BattleEvent",
  transaction_hash: "0xbeef",
  value: {
    game_id: 1,
    attacker_id: 7,
    defender_id: 9,
    winner_id: 7,
    attacker: { player: PLAYER_ACCOUNT },
    defender: { player: "0x0" },
    timestamp: Math.floor(Date.now() / 1000),
  },
});

const startWorker = async (vapid: { publicKey: string; privateKey: string }) => {
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
      if (url.origin === SHARD) return Response.json(heraldAnswer(url));
      if (url.href === PUSH_ENDPOINT) {
        push.received.push(push.status);
        return new Response(null, { status: push.status });
      }
      return new Response("unexpected outbound request", { status: 599 });
    },
  });
  return {
    mf,
    db: await mf.getD1Database("DB"),
    runCron: async () => (await mf.getWorker()).scheduled({ cron: "* * * * *" }),
  };
};

/** The player's account, level, opted-in device and the shard, as sign-in, /devices, settings and the operator leave them. */
const seed = async (db: D1Database, device: { p256dh: string; auth: string }) => {
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
      .prepare(`INSERT INTO "notification_preferences" ("owner", "level", "revision") VALUES (?, 'important', 1)`)
      .bind(OWNER),
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

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitUntil = async (condition: () => boolean, timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) await pause(250);
};

it("alerts the player's device once for a battle on a listed shard, and a restart resends nothing", async () => {
  const vapid = await vapidKeys();
  const first = await startWorker(vapid);
  await seed(first.db as unknown as D1Database, await deviceKeys());

  await first.runCron();
  await pause(4_000); // the notifier reaches the shard's head
  herald.publishedBattle = true;
  await waitUntil(() => push.received.length >= 1, 15_000);
  expect(push.received).toEqual([503]);
  await first.mf.dispose();

  push.status = 201;
  const restarted = await startWorker(vapid);
  await restarted.runCron();
  await waitUntil(() => push.received.includes(201), 20_000);
  await pause(8_000); // two more polls, and the retry window, pass quietly
  expect(push.received).toEqual([503, 201]);
  await restarted.mf.dispose();
}, 90_000);
