import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";
import { hash } from "starknet";
import { gamesAbi, response } from "../../../packages/value-ledger/test-support/abi";
import schema from "../../../contracts/l3/world-native/schema/schema.json";

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
const LAUNCHER = "0x123";
const SHARD_URL = "https://shard.test";
const SHARD_CHAIN = "0x534e5f574f524b4552";
/** The shard's /manifest names its chain and this Worker's release; every other shard call fails, as a node would. */
const SHARD_MANIFEST = {
  version: 1,
  chainId: SHARD_CHAIN,
  l2GasBound: "0x47868c00",
  vrfPublicKey: { x: "0x1", y: "0x2" },
  releaseSchemas: { "1": schema.identity },
  rpcUrl: `${SHARD_URL}/rpc`,
  accountClassHash: "0x2",
  guardianPublicKey: "0x9",
  contracts: { games: "0x77" },
};

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
  const bundle = join(mkdtempSync(join(tmpdir(), "launch-bundle-")), "bundle");
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
  });
  writeFileSync(
    join(bundle, "fixture.js"),
    `
    import {Registrar} from "./worker.js";
    export {default} from "./worker.js";
    export * from "./worker.js";
    export class EnrolledRegistrar extends Registrar {
      constructor(ctx, env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(() => ctx.storage.put(
          ${JSON.stringify(`launcher-account:${BigInt(SHARD_CHAIN).toString(16)}`)},
          {launcherAccount: ${JSON.stringify(LAUNCHER)}}
        ));
      }
    }
  `,
  );
  mf = new Miniflare({
    workers: [
      {
        name: "launch",
        modulesRoot: bundle,
        modules: [
          { type: "ESModule", path: join(bundle, "fixture.js") },
          { type: "ESModule", path: join(bundle, "worker.js") },
        ],
        compatibilityDate: "2026-07-30",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: { DB: "launch" },
        durableObjects: { REGISTRAR: { className: "EnrolledRegistrar", useSQLite: true } },
        serviceBindings: {
          VALUE_IDENTITY: { name: "directory", entrypoint: "ValueIdentity" },
          VALUE_RELAY: { name: "directory", entrypoint: "ValueRelay" },
          IDENTITY: () =>
            Response.json({ session: { id: "s1" }, user: { id: "u1", realmsId: "0x7", address: LAUNCHER } }),
        },
        bindings: {
          ENVIRONMENT: "staging",
          BASE_URL: ORIGIN,
          LAUNCHER_ALLOWLIST: LAUNCHER,
          DEPLOYER_PRIVATE_KEY: "0x1",
          OPERATOR_TOKEN: "operator-test-token",
          VERSION: { id: "workerd-test", tag: "", timestamp: "" },
        },
        outboundService: async (request: Request) => {
          if (request.url === `${SHARD_URL}/manifest`) return Response.json(SHARD_MANIFEST);
          if (request.url === `${SHARD_URL}/rpc`) {
            const { id, method, params } = (await request.json()) as {
              id: number;
              method: string;
              params: { request?: { entry_point_selector?: string } };
            };
            const result =
              method === "starknet_chainId"
                ? SHARD_CHAIN
                : method === "starknet_getBlockWithTxHashes"
                  ? {
                      status: "ACCEPTED_ON_L2",
                      block_number: 1,
                      block_hash: "0x1",
                      timestamp: Math.floor(Date.now() / 1000),
                      transactions: [],
                    }
                  : method === "starknet_getClassAt"
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
        script: `import { WorkerEntrypoint } from "cloudflare:workers"; export class ValueRelay extends WorkerEntrypoint { openSlot(){} } export class ValueIdentity extends WorkerEntrypoint { shards(){return [{chainId:${JSON.stringify(SHARD_CHAIN)},url:${JSON.stringify(SHARD_URL)},status:"active"}];} } export default {fetch(){return new Response(null,{status:404});}};`,
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

afterAll(() => mf?.dispose());

it("opens a Blitz window, ticks the schedule, queues an authorized launch and records the registrar's attempt", async () => {
  const window = {
    // A second ahead: a phase cannot start in the past, and the next slot must close after the window opens.
    startsAt: new Date(Math.ceil(Date.now() / 1_000) * 1_000 + 1_000).toISOString(),
    endsAt: new Date(Math.ceil(Date.now() / 1_000) * 1_000 + 3 * 86_400_000).toISOString(),
  };
  const opened = await mf.dispatchFetch(`${ORIGIN}/api/factory/calendar/blitz`, {
    method: "PUT",
    headers: { origin: ORIGIN, authorization: "Bearer operator-test-token", "content-type": "application/json" },
    body: JSON.stringify(window),
  });
  expect(opened.status).toBe(200);
  await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  const slots = (await (await mf.dispatchFetch(`${ORIGIN}/api/slots`)).json()) as { slots: { name: string }[] };
  expect(slots.slots).toHaveLength(1);
  const waiting = await db.prepare("SELECT name FROM playtest_slots").first<{ name: string }>();
  expect(waiting?.name).toMatch(/^blitz-\d{8}-(11|20)00$/);

  expect(await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()).toMatchObject({
    service: "launch",
    environment: "staging",
    version: "workerd-test",
  });
  expect(await (await mf.dispatchFetch(`${ORIGIN}/api/factory/version`)).json()).toEqual({
    service: "launch",
    environment: "staging",
    version: "workerd-test",
  });

  const launched = await mf.dispatchFetch(`${ORIGIN}/api/factory/runs`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: "better-auth.session_token=s1", "content-type": "application/json" },
    body: JSON.stringify({ environment: "madara.frontier", gameName: "bltz-workerd" }),
  });
  expect(launched.status).toBe(202);

  await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
  const deadline = Date.now() + 10_000;
  let run: { chain_id: string; status: string; attempts: number; error_message: string | null } | null = null;
  while (Date.now() < deadline && !run?.error_message) {
    run = await db.prepare("SELECT chain_id, status, attempts, error_message FROM launch_runs").first();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // The run is keyed to the chain the manifest names, and the registrar's first attempt records the node's failure.
  expect(run).toMatchObject({ chain_id: SHARD_CHAIN, status: "queued", attempts: 1 });
  expect(run?.error_message).toBeTruthy();
}, 60_000);

it("launches a game that is ready now while a result waits an hour for its game's end", async () => {
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
       VALUES ('waiting-result', ?, 'result', 'madara.blitz', 'bltz-later', ?, 'queued', ?, ?, ?)`,
    )
    .bind(
      SHARD_CHAIN,
      JSON.stringify({ environment: "madara.blitz", gameName: "bltz-later", gameId: 4 }),
      now + 3_600_000,
      now,
      now,
    )
    .run();
  await tick(); // a pass finds nothing due and sleeps until the result's hour
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const launched = await mf.dispatchFetch(`${ORIGIN}/api/factory/runs`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: "better-auth.session_token=s1", "content-type": "application/json" },
    body: JSON.stringify({ environment: "madara.frontier", gameName: "bltz-ready" }),
  });
  expect(launched.status).toBe(202);
  await tick();

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && !(await runOf("bltz-ready"))?.error_message) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(await runOf("bltz-ready")).toMatchObject({ attempts: 1 });
  expect(await runOf("bltz-later")).toMatchObject({ attempts: 0 });
}, 60_000);

it("runs a continued launch at once, even while the registrar sleeps until a result's hour", async () => {
  await db.prepare("DELETE FROM launch_runs").run();
  const now = Date.now();
  const insert = (id: string, kind: string, name: string, status: string, availableAt: number, request: object) =>
    db
      .prepare(
        `INSERT INTO launch_runs
           (id, chain_id, kind, environment, name, request, status, available_at, created_at, updated_at)
         VALUES (?, ?, ?, 'madara.blitz', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, SHARD_CHAIN, kind, name, JSON.stringify(request), status, availableAt, now, now)
      .run();
  await insert("waiting", "result", "bltz-later", "queued", now + 3_600_000, {
    environment: "madara.blitz",
    gameName: "bltz-later",
    gameId: 4,
  });
  await insert("stopped", "game", "bltz-failed", "failed", now, {
    environment: "madara.blitz",
    gameName: "bltz-failed",
    gameStartTime: new Date(now + 600_000).toISOString(),
  });
  await (await mf.getWorker()).scheduled({ cron: "* * * * *" }); // the registrar now sleeps until the result's hour
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
