import { shardAccountRpc } from "../../../packages/value-ledger/test-support/shard-account-rpc";
import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";
import { hash } from "starknet";
import { launcherAccountAddress } from "@realms-world/value-ledger";
import { gamesAbi, response } from "../../../packages/value-ledger/test-support/abi";
import schema from "../../../contracts/l3/world-native/schema/schema.json";
import { releaseLine } from "../../../packages/core/src/test-support/releases";

/**
 * The Worker as Cloudflare runs it: the bundle wrangler deploys, its cron tick, its registrar Durable Object and D1 in
 * workerd. Identity and the shard are faked at the network edge.
 */
const STAGING_CONFIG = unstable_readConfig({
  config: new URL("../wrangler.jsonc", import.meta.url).pathname,
  env: "staging",
});
/** The origin the staging Worker serves, read from its wrangler config so the test does not repeat the hostname. */
const ORIGIN = new URL(String(STAGING_CONFIG.vars.BASE_URL)).origin;
const SHARD_URL = "https://shard.test";
const SHARD_CHAIN = "0x534e5f574f524b4552";
/** The shard identity shared by account-join and game-creation network fixtures. */
const SHARD_MANIFEST = {
  version: 1,
  chainId: SHARD_CHAIN,
  l2GasBound: "0x47868c00",
  vrfPublicKey: { x: "0x1", y: "0x2" },
  releases: releaseLine(schema.identity, [1]),
  rpcUrl: `${SHARD_URL}/rpc`,
  accountClassHash: "0x2",
  guardianPublicKey: "0x9",
  contracts: { games: "0x77" },
};

const LAUNCHER = launcherAccountAddress(SHARD_MANIFEST);

let mf: Miniflare;
let bundleRoot: string | undefined;
let db: D1Database;
let freshAccount = false;
let approvalStatus = 401;
let redirectRequests = 0;
let approvalRequests = 0;
const joinRpc = shardAccountRpc({
  address: LAUNCHER,
  classHash: SHARD_MANIFEST.accountClassHash,
  chainId: SHARD_CHAIN,
});

let workerNow: number | null = null;
beforeAll(async () => {
  bundleRoot = mkdtempSync(join(tmpdir(), "launch-bundle-"));
  const bundle = join(bundleRoot, "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  mf = new Miniflare({
    workers: [
      {
        name: "launch",
        modulesRoot: bundle,
        modules: [
          {
            type: "ESModule",
            path: join(bundle, "clock.js"),
            contents: `import worker from "./worker.js";
              export { Registrar } from "./worker.js";
              const realNow = Date.now;
              export default {
                ...worker,
                async fetch(request, env, ctx) {
                  if (new URL(request.url).pathname === "/__clock") {
                    const now = await request.json();
                    Date.now = now === null ? realNow : () => now;
                    return new Response(null, {status: 204});
                  }
                  return worker.fetch(request, env, ctx);
                }
              };`,
          },
          { type: "ESModule", path: join(bundle, "worker.js") },
        ],
        compatibilityDate: "2026-07-30",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: { DB: "launch" },
        durableObjects: { REGISTRAR: { className: "Registrar", useSQLite: true } },
        serviceBindings: {
          IDENTITY: { name: "directory", entrypoint: "ValueIdentity" },
          VALUE_RELAY: { name: "directory", entrypoint: "ValueRelay" },
          IDENTITY_HTTP: (request: Request) => {
            if (new URL(request.url).pathname !== "/api/devices/bots") redirectRequests++;
            approvalRequests++;
            if (!freshAccount)
              return Response.json({ session: { id: "s1" }, user: { id: "u1", realmsId: "0x7", address: LAUNCHER } });
            if (approvalStatus === 302)
              return new Response(null, { status: 302, headers: { location: "https://redirect.test/approval" } });
            return approvalStatus === 200
              ? Response.json({ signature: ["0x3", "0x4"] })
              : Response.json({ error: "unauthorized" }, { status: approvalStatus });
          },
        },
        bindings: {
          ENVIRONMENT: "staging",
          BASE_URL: ORIGIN,
          LAUNCH_DEPLOYER_PRIVATE_KEY: "0x1",
          OPERATOR_TOKEN: "operator-test-token",
          VERSION: { id: "workerd-test", tag: "abc1234", timestamp: "" },
        },
        outboundService: async (request: Request) => {
          if (new URL(request.url).hostname === "redirect.test") {
            redirectRequests++;
            return Response.json({ signature: ["0x3", "0x4"] });
          }
          if (request.url === `${SHARD_URL}/manifest`) return Response.json(SHARD_MANIFEST);
          if (request.url === `${SHARD_URL}/rpc`) {
            const { id, method, params } = (await request.json()) as {
              id: number;
              method: string;
              params: { request?: { entry_point_selector?: string }; contract_address?: string; class_hash?: string };
            };
            if (freshAccount) {
              const joined = joinRpc.respond(id, method);
              if (joined) return joined;
            }
            if (method === "starknet_getClass") expect(params.class_hash).toBe("0xabc");
            const result =
              method === "starknet_chainId"
                ? SHARD_CHAIN
                : method === "starknet_getBlockWithTxHashes"
                  ? {
                      status: "ACCEPTED_ON_L2",
                      block_number: 1,
                      block_hash: "0x1",
                      timestamp: Math.floor((workerNow ?? Date.now()) / 1000),
                      transactions: [],
                    }
                  : method === "starknet_getClassHashAt"
                    ? BigInt(params.contract_address!) === 0x77n
                      ? "0xabc"
                      : SHARD_MANIFEST.accountClassHash
                    : method === "starknet_call" &&
                        params.request?.entry_point_selector === hash.getSelectorFromName("is_device")
                      ? ["0x1"]
                      : method === "starknet_getClass"
                        ? { abi: gamesAbi }
                        : method === "starknet_call" &&
                            params.request?.entry_point_selector === hash.getSelectorFromName("launcher")
                          ? response(gamesAbi, "launcher", LAUNCHER)
                          : undefined;
            if (result !== undefined) return Response.json({ jsonrpc: "2.0", id, result });
          }
          return new Response(`${request.url} unavailable`, { status: 599 });
        },
      },
      {
        name: "directory",
        modules: true,
        script: `import { WorkerEntrypoint } from "cloudflare:workers";
          export class ValueRelay extends WorkerEntrypoint {
            refundSlot() { return null; }
          }
          export class ValueIdentity extends WorkerEntrypoint {
            shard(){return {chainId:${JSON.stringify(SHARD_CHAIN)},url:${JSON.stringify(SHARD_URL)}};}
          }
          export default {};`,
      },
    ],
  });
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const migrations = new URL("../migrations/", import.meta.url);
  const statements = readdirSync(migrations)
    .sort()
    .map((file) => readFileSync(new URL(file, migrations), "utf8").replace(/^--.*$/gm, ""))
    .join(";")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await db.batch(statements.map((statement) => db.prepare(statement)));
}, 180_000);

afterEach(async () => {
  await db.prepare("DELETE FROM launch_runs").run();
  await db.prepare("DELETE FROM season_phases").run();
  await db.prepare("DELETE FROM playtest_slots").run();
  await setWorkerClock(null);
});

afterAll(async () => {
  try {
    await disposeWorker(mf);
  } finally {
    if (bundleRoot) rmSync(bundleRoot, { recursive: true, force: true });
  }
});

const setWorkerClock = (now: string | null) => {
  workerNow = now === null ? null : Date.parse(now);
  return mf.dispatchFetch(`${ORIGIN}/__clock`, { method: "POST", body: JSON.stringify(workerNow) });
};

it("refuses a Blitz window and opens no slot on the cron tick through workerd", async () => {
  await setWorkerClock("2000-01-01T10:00:00Z");
  const window = {
    startsAt: "2000-01-01T07:00:00.000Z",
    endsAt: "2000-01-02T23:00:00.000Z",
  };
  const refused = await mf.dispatchFetch(`${ORIGIN}/api/factory/calendar/blitz`, {
    method: "PUT",
    headers: { origin: ORIGIN, authorization: "Bearer operator-test-token", "content-type": "application/json" },
    body: JSON.stringify(window),
  });
  expect(refused.status).toBe(404);
  await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  expect(await (await mf.dispatchFetch(`${ORIGIN}/api/slots`)).json()).toEqual({ slots: [] });
  expect(await db.prepare("SELECT COUNT(*) AS count FROM playtest_slots").first("count")).toBe(0);
  expect(await db.prepare("SELECT COUNT(*) AS count FROM launch_runs").first("count")).toBe(0);

  expect(await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()).toMatchObject({
    service: "launch",
    environment: "staging",
    version: "workerd-test",
    revision: "abc1234",
  });
  expect(await (await mf.dispatchFetch(`${ORIGIN}/api/factory/version`)).json()).toEqual({
    service: "launch",
    environment: "staging",
    version: "workerd-test",
    revision: "abc1234",
  });
}, 60_000);

it("launches a game that is ready now while another waits an hour for its start", async () => {
  const tick = async () => (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  const runOf = (name: string) =>
    db.prepare("SELECT attempts, error_message FROM launch_runs WHERE name = ?").bind(name).first<{
      attempts: number;
      error_message: string | null;
    }>();
  await db.prepare("DELETE FROM launch_runs").run();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO launch_runs
         (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at)
       VALUES ('waiting-game', ?, 'game', 'madara.blitz', 'bltz-later', ?, 'queued', ?, ?, ?)`,
    )
    .bind(
      SHARD_CHAIN,
      JSON.stringify({ environment: "madara.blitz", gameName: "bltz-later" }),
      now + 3_600_000,
      now,
      now,
    )
    .run();
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  await db
    .prepare(
      `INSERT INTO launch_runs (id,chain_id,kind,environment,name,request,status,available_at,created_at,updated_at)
    VALUES ('ready-game',?,'game','madara.frontier','bltz-ready',?,'queued',?,?,?)`,
    )
    .bind(SHARD_CHAIN, JSON.stringify({ environment: "madara.frontier", gameName: "bltz-ready" }), now, now, now)
    .run();
  await tick();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && !(await runOf("bltz-ready"))?.error_message) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(await runOf("bltz-ready")).toMatchObject({ attempts: 1 });
  expect(await runOf("bltz-later")).toMatchObject({ attempts: 0 });
}, 60_000);

it("runs a continued launch at once, even while the registrar sleeps until a later run's hour", async () => {
  await db.prepare("DELETE FROM launch_runs").run();
  const now = Date.now();
  const insert = (id: string, name: string, status: string, availableAt: number, request: object) =>
    db
      .prepare(
        `INSERT INTO launch_runs
           (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at)
         VALUES (?, ?, 'game', 'madara.blitz', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, SHARD_CHAIN, name, JSON.stringify(request), status, availableAt, now, now)
      .run();
  await insert("waiting", "bltz-later", "queued", now + 3_600_000, {
    environment: "madara.blitz",
    gameName: "bltz-later",
  });
  await insert("stopped", "bltz-failed", "failed", now, {
    environment: "madara.blitz",
    gameName: "bltz-failed",
    gameStartTime: new Date(now + 600_000).toISOString(),
  });
  await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const continued = await mf.dispatchFetch(`${ORIGIN}/api/factory/runs/madara.blitz/bltz-failed/actions/continue`, {
    method: "POST",
    headers: { authorization: "Bearer operator-test-token" },
  });
  expect(continued.status).toBe(202);

  // No cron tick: the continue itself armed the registrar.
  const deadline = Date.now() + 10_000;
  let run: { attempts: number; error_message: string | null } | null = null;
  while (Date.now() < deadline && !run?.error_message) {
    run = await db.prepare("SELECT attempts, error_message FROM launch_runs WHERE name = 'bltz-failed'").first();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(run).toMatchObject({ attempts: 1 });
}, 60_000);

it.each([
  [401, "launcher_approval_refused"],
  [302, "operator_redirect_refused"],
] as const)(
  "reports approval HTTP %s through real workerd without following redirects",
  async (status, code) => {
    freshAccount = true;
    approvalStatus = status;
    approvalRequests = 0;
    redirectRequests = 0;
    try {
      await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
      const deadline = Date.now() + 10000;
      let health: { joinFailure?: { chainId: string; code: string } | null } = {};
      while (Date.now() < deadline) {
        health = (await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()) as typeof health;
        if (approvalRequests > 0 && health.joinFailure?.code === code) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(health.joinFailure).toMatchObject({ chainId: SHARD_CHAIN, code });
      expect(approvalRequests).toBeGreaterThan(0);
      expect(redirectRequests).toBe(0);
      expect(joinRpc.deployed).toBe(false);
    } finally {
      freshAccount = false;
    }
  },
  60000,
);

it("joins a fresh account through identity approval and account deployment in workerd", async () => {
  freshAccount = true;
  approvalStatus = 200;
  try {
    await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
    const deadline = Date.now() + 10000;
    let health: { joinFailure?: unknown } = {};
    while (Date.now() < deadline) {
      health = (await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()) as typeof health;
      if (joinRpc.deployed && health.joinFailure === null) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(joinRpc.deployed).toBe(true);
    expect(health.joinFailure).toBeNull();
  } finally {
    freshAccount = false;
  }
}, 60000);
