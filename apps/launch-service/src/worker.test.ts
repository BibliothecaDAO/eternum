import { shardAccountRpc } from "../../../packages/value-ledger/test-support/shard-account-rpc";
import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { CallData, hash } from "starknet";
import { launcherAccountAddress } from "@realms-world/value-ledger";
import { gamesAbi, gamesEvent, response } from "../../../packages/value-ledger/test-support/abi";
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
const SHARD_URL = "https://shard.test";
const SHARD_CHAIN = "0x534e5f574f524b4552";
/** The shard identity shared by account-join and game-creation network fixtures. */
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

const LAUNCHER = launcherAccountAddress(SHARD_MANIFEST);

let mf: Miniflare;
let bundleRoot: string | undefined;
let db: D1Database;
let freshAccount = false;
let approvalStatus = 401;
let redirectRequests = 0;
let approvalRequests = 0;
let classReads = 0;
const joinRpc = shardAccountRpc({
  address: LAUNCHER,
  classHash: SHARD_MANIFEST.accountClassHash,
  chainId: SHARD_CHAIN,
});

interface FixtureGame {
  name: bigint;
  preset_id: bigint;
  start_settling_at: bigint;
  start_main_at: bigint;
  duration_seconds: bigint;
  end_grace_seconds: bigint;
  seed: bigint;
  dev_mode_on: boolean;
  roster: { account: bigint; wallet: bigint }[];
  seater: bigint;
  /** Players seated by executed seats, and by seats in closed blocks: the open block holds the latest seat. */
  seated: number;
  closedSeated: number;
  seats: number;
}
let playBlitzFixture = false;
let workerNow: number | null = null;
const createdGames: FixtureGame[] = [];
const receipts = new Map<string, Record<string, unknown> & { finality_status: string }>();
/** The open block: the latest seat, which closes when the next seat opens a new block. */
let openSeat: { gameId: number; seated: boolean; hash: string } | null = null;
const createEntry = gamesAbi.find((entry) => entry.name === "create_game")!;
const creationCodec = new CallData([
  ...gamesAbi,
  {
    type: "function",
    name: "creation",
    inputs: [],
    outputs: [{ type: createEntry.inputs[0].type }],
    state_mutability: "view",
  },
]);

/** The network fixture accepts actual signed invokes and serializes views/events from the shipped ABI. */
function blitzRpc(
  method: string,
  params: {
    request?: { entry_point_selector?: string; calldata?: string[] };
    invoke_transaction?: { calldata: string[] };
    transaction_hash?: string;
    contract_address?: string;
    class_hash?: string;
    block_id?: unknown;
  },
) {
  if (method === "starknet_getNonce") return "0x0";
  if (method === "starknet_getTransactionReceipt") return receipts.get(params.transaction_hash!);
  if (method === "starknet_addInvokeTransaction") {
    const calldata = params.invoke_transaction!.calldata;
    expect(BigInt(calldata[0]!)).toBe(1n);
    const selector = BigInt(calldata[2]!);
    const args = calldata.slice(4);
    const transaction_hash = `0x${(receipts.size + 1).toString(16)}`;
    let events: unknown[] = [];
    let finality_status = "ACCEPTED_ON_L2";
    if (selector === BigInt(hash.getSelectorFromName("create_game"))) {
      const game = creationCodec.parse("creation", args) as unknown as FixtureGame;
      createdGames.push({ ...game, seated: 0, closedSeated: 0, seats: 0 });
    } else {
      expect(selector).toBe(BigInt(hash.getSelectorFromName("play")));
      expect(args.slice(4).map(BigInt)).toEqual(
        encodeNativeCommand(bindings.commandAbi, { kind: "SettleBlitzRoster", value: undefined }).map(BigInt),
      );
      const gameId = Number(args[0]);
      const game = createdGames[gameId - 1]!;
      closeOpenSeat();
      const seated = game.seated < game.roster.length;
      if (seated) game.seated++;
      game.seats++;
      openSeat = { gameId, seated, hash: transaction_hash };
      finality_status = "PRE_CONFIRMED";
      events = [
        {
          from_address: "0x77",
          ...gamesEvent("BatchProgress", {
            game_id: gameId,
            actor: LAUNCHER,
            tx_hash: transaction_hash,
            remaining: game.roster.length - game.seated,
          }),
        },
      ];
    }
    receipts.set(transaction_hash, {
      transaction_hash,
      type: "INVOKE",
      finality_status,
      execution_status: "SUCCEEDED",
      block_number: 1,
      block_hash: "0x1",
      actual_fee: { amount: "0x0", unit: "FRI" },
      events,
      messages_sent: [],
      execution_resources: {},
    });
    return { transaction_hash };
  }
  if (method !== "starknet_call") return undefined;
  const { entry_point_selector: selector, calldata = [] } = params.request!;
  const entry = gamesAbi.find(
    (entry) => entry.type === "function" && hash.getSelectorFromName(entry.name) === selector,
  )?.name;
  const game = createdGames[Number(calldata[0]) - 1];
  switch (entry) {
    case "game_id_by_name":
      return response(gamesAbi, entry, createdGames.findIndex((game) => game.name === BigInt(calldata[0]!)) + 1);
    case "game":
      return response(gamesAbi, entry, {
        ...game,
        ready: (params.block_id === "pre_confirmed" ? game!.seated : game!.closedSeated) === game!.roster.length,
        settled: false,
        end_at: game!.start_main_at + game!.duration_seconds,
      });
    case "blitz_roster":
      return response(gamesAbi, entry, game!.roster);
    case "game_seater":
      return response(gamesAbi, entry, game!.seater);
    case "game_release":
    case "preset_commitment":
      return response(gamesAbi, entry, 1);
    case "l2_gas_bound":
      return response(gamesAbi, entry, SHARD_MANIFEST.l2GasBound);
    default:
      return undefined;
  }
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function closeOpenSeat() {
  if (!openSeat) return;
  if (openSeat.seated) createdGames[openSeat.gameId - 1]!.closedSeated++;
  receipts.get(openSeat.hash)!.finality_status = "ACCEPTED_ON_L2";
  openSeat = null;
}

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
              export { Registrar, ValueLaunchDirectory } from "./worker.js";
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
              params: Parameters<typeof blitzRpc>[1];
            };
            if (freshAccount) {
              const joined = joinRpc.respond(id, method);
              if (joined) return joined;
            }
            const blitz = playBlitzFixture ? blitzRpc(method, params) : undefined;
            if (blitz !== undefined) return Response.json({ jsonrpc: "2.0", id, result: blitz });
            if (method === "starknet_getClass") {
              expect(params.class_hash).toBe("0xabc");
              classReads++;
            }
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
          const slots = new Map();
          let count = 25;
          export class ValueRelay extends WorkerEntrypoint {
            openSlot(key, window) {
              slots.set(key.slotId, {exists:true, seasonId:1, presetId:1, close:window.start, end:window.end,
                pool:String(BigInt(count)*100n*10n**18n), registeredCount:count, cancelled:false});
            }
            slot(key) { return slots.get(key.slotId); }
            registrations(key) {
              const slot = slots.get(key.slotId);
              return {slot, blockNumber:10, blockHash:"0xabc", secondsUntilClose:0, next:null,
                registrations:Array.from({length:count},(_,i)=>({wallet:"0x"+(i+1).toString(16),registeredAt:slot.close-10}))};
            }
          }
          export class ValueIdentity extends WorkerEntrypoint {
            accountsAtRegistration(rows){return rows.map((_,i)=>"0x"+(i+257).toString(16));}
            shards(){return [{chainId:${JSON.stringify(SHARD_CHAIN)},url:${JSON.stringify(SHARD_URL)},status:"active"}];}
          }
          export default {async fetch(request){count=Number(await request.text()); slots.clear(); return new Response(null,{status:204});}};`,
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
  playBlitzFixture = false;
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

it.each([0, 1, 2, 25])(
  "creates and seats balanced Blitz games for %i paid registrations through workerd",
  async (count) => {
    createdGames.length = 0;
    receipts.clear();
    openSeat = null;
    await (await mf.getWorker("directory")).fetch("https://fixture/roster", { method: "POST", body: String(count) });
    const sizes = count === 0 ? [] : count <= 24 ? [count] : [13, 12];
    playBlitzFixture = true;
    await setWorkerClock("2000-01-01T10:00:00Z");
    const window = {
      startsAt: "2000-01-01T07:00:00.000Z",
      endsAt: "2000-01-02T23:00:00.000Z",
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
    expect(waiting?.name).toBe("blitz-20000101-1030");
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

    await setWorkerClock("2000-01-01T10:25:00Z");

    await (await mf.getWorker()).scheduled({ cron: "* * * * *" });
    const deadline = Date.now() + 10_000;
    const completed = () =>
      db.prepare("SELECT COUNT(*) AS count FROM launch_runs WHERE kind='game' AND status='complete'").first("count");
    const frozen = () =>
      db.prepare("SELECT frozen_at FROM playtest_slots WHERE name=?").bind(waiting!.name).first("frozen_at");
    while (Date.now() < deadline && ((await completed()) !== sizes.length || !(await frozen()))) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(await completed()).toBe(sizes.length);
    expect(await frozen()).not.toBeNull();
    expect(classReads).toBe(count === 0 ? 0 : 1);
    const orderedGames = [...createdGames].sort((a, b) => (a.name < b.name ? -1 : 1));
    expect(orderedGames.map((game) => game.roster.length)).toEqual(sizes);
    // One seat transaction per player. The last seat is still in the open block, so the launch found its game ready
    // only by reading at the state its seats settle on.
    expect(orderedGames.map(({ seated, seats }) => [seated, seats])).toEqual(sizes.map((size) => [size, size]));
    expect(sum(orderedGames.map(({ seated, closedSeated }) => seated - closedSeated))).toBe(count === 0 ? 0 : 1);
    expect(orderedGames.flatMap((game) => game.roster.map((player) => player.wallet))).toEqual(
      Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    );
    const jobs = await db
      .prepare("SELECT request FROM launch_runs WHERE kind='game' ORDER BY name")
      .all<{ request: string }>();
    expect(jobs.results.map(({ request }) => JSON.parse(request))).toMatchObject(
      sizes.map((_, groupIndex) => ({
        environment: "madara.blitz",
        gameName: `blitz-20000101-1030-${groupIndex + 1}`,
        groupIndex,
        gameStartTime: "2000-01-01T10:30:00.000Z",
        durationSeconds: 3600,
      })),
    );
  },
  60_000,
);

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

  await db
    .prepare(
      `INSERT INTO launch_runs (id,chain_id,kind,environment,name,request,status,available_at,created_at,updated_at)
    VALUES ('ready-game',?,'game','madara.eternum','bltz-ready',?,'queued',?,?,?)`,
    )
    .bind(SHARD_CHAIN, JSON.stringify({ environment: "madara.eternum", gameName: "bltz-ready" }), now, now, now)
    .run();
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
      let health: { joinFailures?: { chainId: string; code: string }[] } = {};
      while (Date.now() < deadline) {
        health = (await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()) as typeof health;
        if (approvalRequests > 0 && health.joinFailures?.[0]?.code === code) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(health.joinFailures).toMatchObject([{ chainId: SHARD_CHAIN, code }]);
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
    let health: { joinFailures?: unknown[] } = {};
    while (Date.now() < deadline) {
      health = (await (await mf.dispatchFetch(`${ORIGIN}/api/factory/health`)).json()) as typeof health;
      if (joinRpc.deployed && health.joinFailures?.length === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(joinRpc.deployed).toBe(true);
    expect(health.joinFailures).toEqual([]);
  } finally {
    freshAccount = false;
  }
}, 60000);
