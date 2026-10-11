import { CallData } from "starknet";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gamesAbi, response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../../packages/value-ledger/test-support/ledger-abi";
import { publishFrontierPools } from "./frontier-pools";

const rpc = vi.hoisted(() => ({ call: vi.fn(), ledger: vi.fn(), execute: vi.fn(), receipt: vi.fn(), now: 50 }));
vi.mock("../../../packages/value-ledger/src/rpc", () => ({
  rpcAt: (url: string) => ({
    getChainId: async () => "0x1",
    getBlock: async (height: number | string) => ({
      status: "ACCEPTED_ON_L2",
      block_number: typeof height === "number" ? height : published === null ? 10 : 11,
      block_hash: "0xa",
      parent_hash: "0x9",
      timestamp: rpc.now,
    }),
    getClassAt: async () => ({ abi: gamesAbi }),
    callContract: url.includes("ledger") ? rpc.ledger : rpc.call,
    getTransactionReceipt: rpc.receipt,
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const target = {
  rpcUrl: "https://shard.test",
  chainId: "0x1",
  gamesAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "0x1",
};
const publish = () =>
  publishFrontierPools(target, "https://herald.test", { rpcUrl: "https://ledger.test", address: "0x30" });
let published: bigint | null;
let lag: boolean;
let reverted: boolean;
let snapshotPool: string | null;
let deposit: bigint;
let seed: number;
let start: number;
let ids: number[];
let end: number;
const snapshot = (id: number) => ({
  game_id: String(id),
  confirmed_block: snapshotPool && BigInt(snapshotPool) > 0n ? 11 : 10,
  models: [
    {
      model: "GameRegistry",
      rows: [{ key: String(id), value: { game_id: id, start_main_at: 10, end_at: end, seed: 153 } }],
    },
    {
      model: "ChestRules",
      rows: [
        {
          key: String(id),
          value: {
            game_id: id,
            price_ceiling: "10",
            shares: { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 },
            claim_window_seconds: 604800,
          },
        },
      ],
    },
    { model: "SliceRules", rows: [{ key: String(id), value: { game_id: id, day_unit_seconds: 5 } }] },
    {
      model: "LordsBudget",
      rows:
        snapshotPool === null
          ? []
          : [
              {
                key: String(id),
                value: {
                  game_id: id,
                  pool: snapshotPool,
                  pool_left: snapshotPool,
                  open: "0",
                  day: "0",
                  price: "10",
                  rolled_shares: "0",
                  yesterday_shares: "0",
                  yesterday_ticks: "0",
                },
              },
            ],
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  rpc.now = 50;
  published = null;
  lag = false;
  reverted = false;
  snapshotPool = null;
  deposit = 123n * 10n ** 18n;
  seed = 153;
  start = 10;
  end = 110;
  ids = [7];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      const path = new URL(String(url)).pathname;
      return Response.json(
        path === "/games"
          ? {
              chain: "0x1",
              world_address: "0x10",
              confirmed_block: 10,
              games: ids.map((id) => ({
                game_id: id,
                preset_id: 5,
                mode: "frontier",
                status: "Live",
                clock: { end_at: end },
              })),
            }
          : snapshot(Number(path.split("/")[2])),
      );
    }),
  );
  rpc.call.mockImplementation(async ({ entrypoint }) => {
    if (entrypoint === "l2_gas_bound") return ["1000000"];
    throw new Error(`unexpected view: ${entrypoint}`);
  });
  rpc.ledger.mockImplementation(async ({ entrypoint }) =>
    response(
      ledgerAbi,
      entrypoint,
      entrypoint === "get_frontier"
        ? {
            funded: true,
            start,
            end: 110,
            pool: { low: deposit, high: 0 },
            paid: { low: 0, high: 0 },
            closed: false,
            preset_id: 2,
            seed,
          }
        : {
            entry_fee: { low: 0, high: 0 },
            protocol_cut_bps: 0,
            chest_lords_bps: 0,
            paid_fraction_bps: 0,
            decay_bps: 0,
            sword_price: { low: 0, high: 0 },
            shield_price: { low: 0, high: 0 },
            mmr: { enabled: false, mean: 0, spread: 0, max_delta: 0, k: 0, regression_bps: 0 },
            day_unit_seconds: 5,
            claim_window_seconds: 604800,
          },
    ),
  );
  rpc.execute.mockImplementation(async () => {
    reverted = published !== null;
    published ??= deposit / 10n ** 18n;
    if (!lag) snapshotPool = String(published);
    return { transaction_hash: "0xabc" };
  });
  rpc.receipt.mockResolvedValue({
    block_number: 11,
    block_hash: "0xb",
    finality_status: "ACCEPTED_ON_L2",
    isReverted: () => reverted,
    revert_reason: "Frontier pool already published",
    events: [],
  });
});
afterEach(() => vi.unstubAllGlobals());

it.each([null, "0"])(
  "publishes the actual deposit for an unpublished budget %s once and reads it back from the confirmed snapshot",
  async (pool) => {
    snapshotPool = pool;
    await publish();
    const calldata = new CallData(gamesAbi).compile("publish_frontier_pool", { game_id: 7, amount: 123 });
    expect(calldata.map(BigInt)).toEqual([7n, 123n]);
    expect(rpc.execute).toHaveBeenCalledWith(
      { contractAddress: "0x10", entrypoint: "publish_frontier_pool", calldata },
      expect.anything(),
    );
    await publish();
    expect(rpc.execute).toHaveBeenCalledOnce();
  },
);
it("does not read funding or invoke when the snapshot already has a published pool", async () => {
  snapshotPool = "123";
  await publish();
  expect(rpc.ledger).not.toHaveBeenCalled();
  expect(rpc.execute).not.toHaveBeenCalled();
});
it.each(["start", "end", "seed", "fraction", "empty", "ended"])(
  "never publishes invalid or ended funding: %s",
  async (kind) => {
    if (kind === "start") start = 11;
    if (kind === "end") end = 210;
    if (kind === "seed") seed = 154;
    if (kind === "fraction") deposit++;
    if (kind === "empty") deposit = 0n;
    if (kind === "ended") end = 49;
    if (kind === "ended") await publish();
    else await expect(publish()).rejects.toThrow();
    expect(rpc.execute).not.toHaveBeenCalled();
  },
);
it("keeps trying other seasons when an unfunded view refuses, and retries funding next tick", async () => {
  ids = [7, 8];
  rpc.ledger.mockRejectedValueOnce(new Error("Ledger: unknown Frontier season"));
  await expect(publish()).rejects.toThrow("unknown Frontier season");
  expect(rpc.execute).toHaveBeenCalledOnce();
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual([8n, 123n]);
  published = null;
  snapshotPool = null;
  ids = [7];
  await publish();
  expect(rpc.execute).toHaveBeenCalledTimes(2);
});
it("recovers an included publication after a lost acknowledgement without a second invoke", async () => {
  rpc.execute.mockImplementationOnce(async () => {
    published = 123n;
    throw new Error("lost_acknowledgement");
  });
  await expect(publish()).rejects.toThrow("lost_acknowledgement");
  snapshotPool = "123";
  await publish();
  expect(rpc.execute).toHaveBeenCalledOnce();
});
it("refuses a different pool revealed by the confirmed snapshot after a duplicate refusal", async () => {
  published = 122n;
  await expect(publish()).rejects.toThrow("frontier_pool_differs_from_ledger");
  expect(published).toBe(122n);
  expect(rpc.execute).toHaveBeenCalledOnce();
});
it("does not report success when the publication is absent at readback", async () => {
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  await expect(publish()).rejects.toThrow("frontier_pool_confirmation_pending");
});

it("publishes before the game starts as well as after days have elapsed", async () => {
  rpc.now = 0;
  await publish();
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual([7n, 123n]);
});

it("never publishes while the ledger transport is unavailable", async () => {
  rpc.ledger.mockRejectedValue(new Error("ledger_offline"));
  await expect(publish()).rejects.toThrow("ledger_offline");
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("treats duplicate publication as pending until the next confirmed snapshot shows the pool", async () => {
  lag = true;
  await expect(publish()).rejects.toThrow("frontier_pool_confirmation_pending");
  await expect(publish()).rejects.toThrow("frontier_pool_confirmation_pending");
  expect(published).toBe(123n);
  expect(reverted).toBe(true);
  snapshotPool = "123";
  await publish();
  expect(rpc.execute).toHaveBeenCalledTimes(2);
  expect(rpc.call.mock.calls.every(([request]) => request.entrypoint !== "lords_budget")).toBe(true);
});

it("does not treat another contract refusal as already published", async () => {
  rpc.receipt.mockResolvedValue({
    block_number: 11,
    finality_status: "ACCEPTED_ON_L2",
    isReverted: () => true,
    revert_reason: "only ledger operator",
    events: [],
  });
  await expect(publish()).rejects.toMatchObject({ message: "shard_invoke_reverted", cause: "only ledger operator" });
});
