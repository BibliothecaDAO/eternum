import { Effect, Layer } from "effect";
import { hash } from "starknet";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { gameRegistryRow, type GameRegistryWire } from "../../../packages/core/src/test-support/game-registry";
import { argument, gamesAbi as abi, response } from "../../../packages/value-ledger/test-support/abi";
import { createLaunchApp } from "./app";
import { D1CalendarStore } from "./calendar-store";
import { launchExecutorLayer } from "./executor";
import { processNextLaunch } from "./process-launch";
import { LaunchShard } from "./shard-client";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore, databaseLayer } from "./store";
import { createLaunchTestDatabase, DEV_CHAIN, slotValueFixture, testChain } from "./test-database";

vi.mock("../../../packages/value-ledger/src/rpc", async (original) => {
  const actual = await original<typeof import("../../../packages/value-ledger/src/rpc")>();
  const rpcAt = (url: string) => {
    const provider = actual.rpcAt(url);
    provider.channel.baseFetch = shardNetwork;
    return provider;
  };
  return { ...actual, rpcAt };
});

interface HeldGame {
  launch: string;
  row: GameRegistryWire;
}
let held: HeldGame[];
const heldRow = (params: Record<string, bigint | boolean>): GameRegistryWire => {
  const endAt = String(BigInt(params.start_main_at!) + BigInt(params.duration_seconds!));
  return gameRegistryRow({
    name: String(params.name),
    family: Number(params.family),
    dev_mode_on: Boolean(params.dev_mode_on),
    start_settling_at: String(params.start_settling_at),
    start_main_at: String(params.start_main_at),
    end_at: endAt,
    scheduled_end_at: endAt,
    seed: String(params.seed),
  });
};
const createGame = (calldata: string[]) => {
  const row = heldRow(argument(abi, "create_game", calldata) as Record<string, bigint | boolean>);
  const launch = calldata.join();
  const previous = held.find((game) => game.row.name === row.name);
  if (previous && previous.launch !== launch) throw new Error("conflicting game launch");
  if (!previous) held.push({ launch, row });
};
const VIEWS = ["l2_gas_bound", "game_id_by_name", "game"] as const;
const viewGames = (selector: string, calldata: string[]) => {
  const view = VIEWS.find((name) => BigInt(hash.getSelectorFromName(name)) === BigInt(selector));
  if (view === "l2_gas_bound") return ["0xf4240"];
  if (view === "game_id_by_name")
    return [String(held.findIndex((game) => BigInt(game.row.name) === BigInt(calldata[0]!)) + 1)];
  if (view === "game") return response(abi, "game", held[Number(calldata[0]) - 1]!.row);
  throw new Error(`unexpected view ${selector}`);
};
const receipt = {
  type: "INVOKE",
  transaction_hash: "0xabc",
  actual_fee: { amount: "0x0", unit: "FRI" },
  finality_status: "ACCEPTED_ON_L2",
  execution_status: "SUCCEEDED",
  block_hash: "0xb",
  block_number: 11,
  messages_sent: [],
  events: [],
  execution_resources: { l1_gas: 0, l1_data_gas: 0, l2_gas: 0 },
};
const block = {
  status: "ACCEPTED_ON_L2",
  block_number: 10,
  block_hash: "0xa",
  parent_hash: "0x9",
  timestamp: 100,
  new_root: "0x1",
  sequencer_address: "0x1",
  starknet_version: "0.14.0",
  l1_da_mode: "BLOB",
  l1_gas_price: { price_in_fri: "0x1", price_in_wei: "0x1" },
  l1_data_gas_price: { price_in_fri: "0x1", price_in_wei: "0x1" },
  l2_gas_price: { price_in_fri: "0x1", price_in_wei: "0x1" },
  transactions: [],
};
type RpcParams = {
  request?: { entry_point_selector: string; calldata: string[] };
  invoke_transaction?: { calldata: string[] };
};
const shardRpc = (method: string, params: RpcParams) => {
  if (method === "starknet_call") return viewGames(params.request!.entry_point_selector, params.request!.calldata);
  if (method === "starknet_addInvokeTransaction") {
    createGame(params.invoke_transaction!.calldata.slice(4));
    return { transaction_hash: receipt.transaction_hash };
  }
  const answers: Record<string, unknown> = {
    starknet_specVersion: "0.10.0",
    starknet_chainId: DEV_CHAIN,
    starknet_getNonce: "0x0",
    starknet_getBlockWithTxHashes: block,
    starknet_getClassHashAt: "0xabc",
    starknet_getClass: { abi: JSON.stringify(abi), sierra_program: [], contract_class_version: "0.1.0" },
    starknet_getTransactionReceipt: receipt,
  };
  return answers[method];
};
const manifest = {
  version: 1,
  chainId: DEV_CHAIN,
  rpcUrl: "https://shard.test/rpc",
  accountClassHash: "0x2",
  guardianPublicKey: "0x9",
  contracts: { games: "0x77" },
};
const shardNetwork: typeof fetch = async (input, init) => {
  if (String(input instanceof Request ? input.url : input).endsWith("/manifest")) return Response.json(manifest);
  const { id, method, params } = JSON.parse(String(init?.body)) as { id: number; method: string; params: RpcParams };
  const result = shardRpc(method, params);
  return Response.json(
    result === undefined
      ? { jsonrpc: "2.0", id, error: { code: -32601, message: `unanswered ${method}` } }
      : { jsonrpc: "2.0", id, result },
  );
};

const season = {
  environment: "madara.frontier" as const,
  gameName: "frontier-fixture",
  gameStartTime: "2026-11-21T00:00:00.000Z",
  durationSeconds: 4_320_000,
};
const target = {
  directory: { shard: async () => ({ url: "https://shard.test", chainId: DEV_CHAIN }) },
  accountAddress: "0x1",
  privateKey: "0x12345",
};
const launchShard = () =>
  new LaunchShard({ rpcUrl: "https://shard.test/rpc", chainId: DEV_CHAIN, gamesAddress: "0x77", ...target });

let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  held = [];
  vi.stubGlobal("fetch", vi.fn(shardNetwork));
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  await database.close();
  vi.unstubAllGlobals();
});

test("a retried launch finds the game its first attempt created", async () => {
  const createdAt = Date.parse("2026-11-20T00:00:00.000Z");
  const first = await launchShard().create(season, createdAt);
  const retried = await launchShard().create(season, createdAt);
  expect(first).toMatchObject({ gameId: 1, gameName: season.gameName, startTime: 1_795_219_200 });
  expect(first.durationSeconds).toBe(season.durationSeconds);
  expect(retried).toEqual(first);
  expect(held).toHaveLength(1);
});

test("a retried launch still finds its game after the race ended it early", async () => {
  const createdAt = Date.parse("2026-11-20T00:00:00.000Z");
  await launchShard().create(season, createdAt);
  held[0]!.row = { ...held[0]!.row, end_at: "1795300000" };
  expect(await launchShard().create(season, createdAt)).toMatchObject({ gameId: 1, durationSeconds: 80_800 });
});

test("a name the registry holds under another seed is not this launch", async () => {
  const createdAt = Date.parse("2026-11-20T00:00:00.000Z");
  await launchShard().create(season, createdAt);
  held[0]!.row = { ...held[0]!.row, seed: "7" };
  await expect(launchShard().create(season, createdAt)).rejects.toThrow("game_launch_identity_differs");
});

test("a failed run whose game the shard holds completes when continued, and the directory lists the game", async () => {
  const store = new D1LaunchStore(database.db, testChain(DEV_CHAIN));
  const app = createLaunchApp({
    config: { operatorToken: "operator-test-token" },
    deployment: { environment: "dev", version: "test", revision: "abc1234" },
    store,
    slots: new D1SlotStore(database.db, store, slotValueFixture()),
    calendar: new D1CalendarStore(database.db),
    registrar: {
      armFor: async () => {},
      joinFailure: async () => null,
      wakeAt: async () => 0,
      applyRelease: async () => ({ shard: null }),
    },
  });
  const operator = { authorization: "Bearer operator-test-token" };
  const directory = async () => (await app.request("/api/factory/directory-games", { headers: operator })).json();
  const run = await store.enqueue(season);
  await launchShard().create(run.request, Date.parse(run.createdAt));
  await store.startNext(Date.now());
  await store.fail(run.id, "game_launch_identity_differs");
  expect(await directory()).toEqual({ chains: [] });

  const continued = await app.request(`/api/factory/runs/${season.environment}/${season.gameName}/actions/continue`, {
    method: "POST",
    headers: operator,
  });
  expect(continued.status).toBe(202);
  await Effect.runPromise(
    processNextLaunch(Date.now()).pipe(
      Effect.provide(Layer.mergeAll(databaseLayer(store), launchExecutorLayer(target))),
    ),
  );

  expect(await store.find(season.environment, season.gameName)).toMatchObject({ status: "complete" });
  expect(await directory()).toEqual({ chains: [{ chainId: DEV_CHAIN, games: [{ gameId: 1, slotId: null }] }] });
  expect(held).toHaveLength(1);
});
