import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { type Account, type RpcProvider } from "starknet";
import { gamesAbi, response } from "../../../../../../packages/value-ledger/test-support/abi";
import { ledgerAbi, ledgerCall } from "../../../../../../packages/value-ledger/test-support/ledger-abi";
import { ShardReader } from "../../../../../../apps/value-relay/src/shard-rpc";
import devBook from "../../../../../common/addresses/dev.json";
import productionBook from "../../../../../common/addresses/production.json";
import { fundFrontier, carryFrontier } from "./fund-frontier";
import { frontierDevconPreset } from "../../../../../../config/source/frontier/devcon";
import { seasonDayUnitSeconds } from "../../../../../../config/source/common/season-clock";

const savedDev = { ...devBook };
const savedProduction = { ...productionBook };
const shard = { chainId: "0x7", gamesAddress: "0x77", rpcUrl: "https://shard.test" };
const head = { status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xaa", parent_hash: "0x9", timestamp: 150 };
const game = {
  name: 1,
  preset_id: 6,
  settled: false,
  ready: true,
  dev_mode_on: false,
  start_settling_at: 100,
  start_main_at: 100,
  end_at: 300,
  end_grace_seconds: 0,
  seed: 99,
};
let models: { model: string; rows: { key: string; value: Record<string, unknown> }[] }[];
let block = head;
let preset: string[];
let season: string[];
const execute = mock(async (_calls: unknown) => ({ transaction_hash: "0xabc" }));
const receipt = mock(async () => ({ execution_status: "SUCCEEDED", block_number: 11 }));
const shardCall = mock(async () => response(gamesAbi, "game", game));
const ledgerRead = mock(async ({ entrypoint }: { entrypoint: string }) => {
  if (entrypoint === "get_preset") return preset;
  if (entrypoint === "get_frontier") return season;
  if (entrypoint === "lords") return ["0x111"];
  throw new Error(`Unexpected read ${entrypoint}`);
});
const provider = {
  getChainId: async () => shard.chainId,
  getBlock: async () => block,
  getClassAt: async () => ({ abi: gamesAbi }),
  callContract: shardCall,
} as unknown as RpcProvider;
const account = {
  getChainId: async () => "0x534e5f4d41494e",
  getBlock: async () => ({ ...head, block_number: 11 }),
  callContract: ledgerRead,
  execute,
  waitForTransaction: receipt,
} as unknown as Account;
const run = (amount = "1000000") => fundFrontier(account, provider, shard, "https://herald.test", 42, "dev", amount);
let header: ReturnType<typeof spyOn>;
let fetchMock: ReturnType<typeof spyOn>;
beforeEach(() => {
  Object.assign(devBook, { ledger: "0x123", lords: "0x111" });
  Object.assign(productionBook, { ledger: "0x456", lords: "0x222" });
  block = head;
  execute.mockClear();
  receipt.mockClear();
  shardCall.mockClear();
  ledgerRead.mockClear();
  ledgerRead.mockImplementation(async ({ entrypoint }) => {
    if (entrypoint === "get_preset") return preset;
    if (entrypoint === "get_frontier") return season;
    if (entrypoint === "lords") return ["0x111"];
    throw new Error(`Unexpected read ${entrypoint}`);
  });
  receipt.mockResolvedValue({ execution_status: "SUCCEEDED", block_number: 11 });
  shardCall.mockImplementation(async () => response(gamesAbi, "game", game));
  models = [
    { model: "GameRegistry", rows: [{ key: "42", value: { game_id: 42, ...game } }] },
    {
      model: "ChestRules",
      rows: [
        {
          key: "42",
          value: {
            pool_bps: frontierDevconPreset.chests.poolBps,
            top_n: frontierDevconPreset.chests.topN,
            game_id: 42,
            claim_window_seconds: 604800,
          },
        },
      ],
    },
    { model: "SliceRules", rows: [{ key: "42", value: { game_id: 42, day_unit_seconds: 10 } }] },
  ];
  preset = response(ledgerAbi, "get_preset", {
    frontier_top_n: frontierDevconPreset.chests.topN,
    frontier_chest_bps: frontierDevconPreset.chests.poolBps,
    entry_fee: { low: 0, high: 0 },
    protocol_cut_bps: 0,
    chest_lords_bps: 0,
    paid_fraction_bps: 0,
    decay_bps: 0,
    sword_price: { low: 0, high: 0 },
    shield_price: { low: 0, high: 0 },
    mmr: { enabled: false, mean: 1500, spread: 450, max_delta: 45, k: 50, regression_bps: 150 },
    day_unit_seconds: 10,
    claim_window_seconds: 604800,
  });
  season = response(ledgerAbi, "get_frontier", {
    prize_pool: { low: 3n * 10n ** 23n, high: 0 },
    prize_paid: { low: 0, high: 0 },
    funded: true,
    start: 100,
    end: 300,
    pool: { low: 7n * 10n ** 23n, high: 0 },
    paid: { low: 0, high: 0 },
    closed: false,
    preset_id: 6,
    seed: 99,
  });
  header = spyOn(ShardReader.prototype, "header").mockResolvedValue(head as never);
  fetchMock = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async () =>
        Response.json({
          game_id: "42",
          confirmed_block: 10,
          models,
        }),
      { preconnect: fetch.preconnect },
    ),
  );
});
afterEach(() => {
  Object.assign(devBook, savedDev);
  Object.assign(productionBook, savedProduction);
  header.mockRestore();
  fetchMock.mockRestore();
});

test("funds a confirmed running game, with exactly the requested deposit and compiled ledger calldata", async () => {
  expect(await run()).toMatchObject({
    gameId: 42,
    transactionHash: "0xabc",
    frontier: { pool: String(7n * 10n ** 23n), prizePool: String(3n * 10n ** 23n), end: 300 },
  });
  expect(shardCall).toHaveBeenCalledWith({ contractAddress: "0x77", entrypoint: "game", calldata: ["42"] }, 10);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0]![0]).toEqual([
    { contractAddress: "0x111", entrypoint: "approve", calldata: ["291", String(10n ** 24n), "0"] },
    {
      contractAddress: "0x123",
      entrypoint: "fund_frontier",
      calldata: ledgerCall("fund_frontier", {
        shard: 7,
        season_id: 42,
        preset_id: 6,
        start: 100,
        end: 300,
        seed: 99,
        amount: { low: 10n ** 24n, high: 0 },
      }),
    },
  ]);
  expect(ledgerRead).toHaveBeenCalledWith(
    { contractAddress: "0x123", entrypoint: "get_frontier", calldata: ["0x7", "42"] },
    11,
  );
});

test.each([16, 17])("refuses mismatched ledger day/window terms before signing (%i)", async (index) => {
  preset[index] = String(BigInt(preset[index]!) + 1n);
  await expect(run()).rejects.toThrow("frontier_funding_differs_from_game");
  expect(execute).not.toHaveBeenCalled();
});
test.each(["start_main_at", "end_at", "seed", "preset_id"])(
  "refuses a mismatched confirmed game field %s",
  async (field) => {
    models[0]!.rows[0]!.value[field] = 999;
    await expect(run()).rejects.toThrow("Herald game differs");
    expect(execute).not.toHaveBeenCalled();
  },
);
test.each(["0", "-1", "1.5", "1e6", "0x10", "", " 1", "01"])(
  "refuses nonpositive or nondecimal whole amount %s before reads",
  async (amount) => {
    await expect(run(amount)).rejects.toThrow("Amount must be positive whole LORDS");
    expect(execute).not.toHaveBeenCalled();
    expect(shardCall).not.toHaveBeenCalled();
  },
);
test("refuses a whole amount whose wei exceeds u128 before reads", async () => {
  const tooLarge = ((1n << 128n) - 1n) / 10n ** 18n + 1n;
  await expect(run(String(tooLarge))).rejects.toThrow("Deposit must fit u128 wei");
  expect(execute).not.toHaveBeenCalled();
  expect(shardCall).not.toHaveBeenCalled();
});
test.each([1n, ((1n << 128n) - 1n) / 10n ** 18n])("funds operator amount %s without a preset pool", async (amount) => {
  const wei = amount * 10n ** 18n;
  const prize = ((amount * 3000n) / 10000n) * 10n ** 18n;
  season[3] = String(wei - prize);
  season[10] = String(prize);
  const result = await run(String(amount));
  expect(result.frontier.pool).toBe(String(wei - prize));
  expect(result.frontier.prizePool).toBe(String(prize));
  expect(execute.mock.calls[0]![0]).toMatchObject([
    { entrypoint: "approve", calldata: ["291", String(wei), "0"] },
    { entrypoint: "fund_frontier" },
  ]);
});
test("refuses a confirmed readback with a different deposited amount", async () => {
  season[3] = "0";
  season[10] = "0";
  await expect(run("1")).rejects.toThrow("Frontier deposit differs from requested amount");
});
test("refuses a missing game, unconfirmed snapshot or missing chest rules before signing", async () => {
  shardCall.mockRejectedValueOnce(new Error("game does not exist"));
  await expect(run()).rejects.toThrow("game does not exist");
  block = { ...head, status: "PRE_CONFIRMED" };
  await expect(run()).rejects.toThrow("ledger_head_unconfirmed");
  block = head;
  models[1]!.rows = [];
  await expect(run()).rejects.toThrow("snapshot_row_missing");
  expect(execute).not.toHaveBeenCalled();
});
test("refuses an ended season before approving tokens", async () => {
  spyOn(account, "getBlock").mockResolvedValueOnce({ ...head, timestamp: 300 } as never);
  await expect(run()).rejects.toThrow("Frontier season has ended");
  expect(execute).not.toHaveBeenCalled();
});
test("refuses a reverted receipt or a different readback", async () => {
  receipt.mockResolvedValueOnce({ execution_status: "REVERTED", block_number: 11 });
  await expect(run()).rejects.toThrow("Funding not confirmed");
  season[9] = "100";
  await expect(run()).rejects.toThrow("frontier_funding_differs_from_game");
});

test("refuses a wrong shard chain before any ledger approval", async () => {
  const wrong = { ...provider, getChainId: async () => "0x8" } as unknown as RpcProvider;
  await expect(fundFrontier(account, wrong, shard, "https://herald.test", 42, "dev", "1000000")).rejects.toThrow(
    "manifest shard",
  );
  expect(execute).not.toHaveBeenCalled();
});
test.each([0, -1, 0x100000000, 1.5])("refuses invalid game id %s before reads", async (id) => {
  await expect(fundFrontier(account, provider, shard, "https://herald.test", id, "dev", "1000000")).rejects.toThrow(
    "Invalid shard game id",
  );
  expect(shardCall).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});

test("production funding uses only its own book and the native preset ID", async () => {
  ledgerRead.mockResolvedValueOnce(preset).mockResolvedValueOnce(["0x222"]);
  season[8] = "6";
  await fundFrontier(account, provider, shard, "https://herald.test", 42, "production", "1000000");
  expect(ledgerRead).toHaveBeenCalledWith({ contractAddress: "0x456", entrypoint: "get_preset", calldata: ["6"] }, 11);
  const calls = execute.mock.calls[0]![0] as { calldata: string[] }[];
  expect(calls[1]!.calldata[2]).toBe("6");
  expect(execute.mock.calls[0]![0]).toMatchObject([
    { contractAddress: "0x222", calldata: ["1110", String(10n ** 24n), "0"] },
    { contractAddress: "0x456" },
  ]);
});

test.each(["dev", "production"] as const)(
  "%s funding refuses a ledger token from the other book",
  async (environment) => {
    ledgerRead.mockResolvedValueOnce(preset).mockResolvedValueOnce([environment === "dev" ? "0x222" : "0x111"]);
    await expect(
      fundFrontier(account, provider, shard, "https://herald.test", 42, environment, "1000000"),
    ).rejects.toThrow("Ledger token differs");
    expect(execute).not.toHaveBeenCalled();
  },
);

test.each([
  ["dev", "ledger"],
  ["dev", "lords"],
  ["production", "ledger"],
  ["production", "lords"],
] as const)("%s funding requires its own book address for %s", async (environment, field) => {
  (environment === "dev" ? devBook : productionBook)[field] = "";
  await expect(
    fundFrontier(account, provider, shard, "https://herald.test", 42, environment, "1000000"),
  ).rejects.toThrow(field);
  expect(execute).not.toHaveBeenCalled();
  expect(shardCall).not.toHaveBeenCalled();
});

test.each(["dev", "production"] as const)(
  "%s funding refuses Sepolia before any shard read or approval",
  async (environment) => {
    const wrong = { ...account, getChainId: async () => "0x534e5f5345504f4c4941" } as unknown as Account;
    await expect(
      fundFrontier(wrong, provider, shard, "https://herald.test", 42, environment, "1000000"),
    ).rejects.toThrow("chain");
    expect(execute).not.toHaveBeenCalled();
    expect(shardCall).not.toHaveBeenCalled();
  },
);

test("funding refuses a network name instead of an environment", async () => {
  await expect(
    fundFrontier(account, provider, shard, "https://herald.test", 42, "mainnet" as "dev", "1000000"),
  ).rejects.toThrow("environment");
  expect(execute).not.toHaveBeenCalled();
});

test("carries an already settled remainder once before the old deadline, preserving both prize pots", async () => {
  const previous = [...season];
  previous[1] = "0";
  previous[2] = "100";
  previous[5] = String(200000n * 10n ** 18n);
  previous[7] = "1";
  let moved = false;
  ledgerRead.mockImplementation(async ({ entrypoint, calldata }: { entrypoint: string; calldata?: string[] }) => {
    if (entrypoint === "get_frontier") {
      if (calldata?.[1] === "41") return previous;
      return season.map((x, i) => (i === 3 && moved ? String(1200000n * 10n ** 18n) : x));
    }
    if (entrypoint === "get_preset") return preset;
    if (entrypoint === "frontier_carry") return [!moved ? String(500000n * 10n ** 18n) : "0", "0"];
    throw new Error("Unexpected carry read");
  });
  execute.mockImplementationOnce(async () => {
    moved = true;
    return { transaction_hash: "0xabc" };
  });
  const runCarry = () => carryFrontier(account, provider, shard, "https://herald.test", 41, 42, "dev");
  const result = await runCarry();
  expect(result.frontier.pool).toBe(String(1200000n * 10n ** 18n));
  expect(result.frontier.prizePool).toBe(String(300000n * 10n ** 18n));
  expect(execute.mock.calls[0]![0]).toEqual([
    { contractAddress: "0x123", entrypoint: "apply_frontier_carry", calldata: ["0x7", "42"] },
  ]);
  await runCarry();
  expect(execute).toHaveBeenCalledTimes(1);
});

test.each(["dev", "production"] as const)(
  "%s carry refuses an unsettled season even after its old claim deadline",
  async (environment) => {
    const previous = [...season];
    previous[1] = "0";
    previous[2] = "100";
    const shortPreset = [...preset];
    shortPreset[17] = "50";
    models[1]!.rows[0]!.value.claim_window_seconds = 50;
    ledgerRead.mockImplementation(async ({ entrypoint, calldata }: { entrypoint: string; calldata?: string[] }) => {
      if (entrypoint === "get_frontier") return calldata?.[1] === "41" ? previous : season;
      if (entrypoint === "get_preset") return shortPreset;
      throw new Error("Unsettled custody must not be read as carry");
    });
    await expect(carryFrontier(account, provider, shard, "https://herald.test", 41, 42, environment)).rejects.toThrow(
      "Previous season payouts are not settled",
    );
    expect(execute).not.toHaveBeenCalled();
  },
);

test.each(["dev", "production"] as const)(
  "%s funds the 80-hour Devcon game with 300k split into 210k chests and 90k top-three prizes",
  async (environment) => {
    const startsAt = 1793687400;
    const endsAt = 1793975400;
    const devcon = { ...game, start_main_at: startsAt, end_at: endsAt };
    models[0]!.rows[0]!.value = { game_id: 42, ...devcon };
    models[2]!.rows[0]!.value.day_unit_seconds = seasonDayUnitSeconds(frontierDevconPreset);
    shardCall.mockImplementation(async () => response(gamesAbi, "game", devcon));
    preset[16] = String(seasonDayUnitSeconds(frontierDevconPreset));
    season[1] = String(startsAt);
    season[2] = String(endsAt);
    season[3] = String(210000n * 10n ** 18n);
    season[10] = String(90000n * 10n ** 18n);
    const token = environment === "dev" ? "0x111" : "0x222";
    const ledger = environment === "dev" ? "0x123" : "0x456";
    ledgerRead.mockImplementation(async ({ entrypoint }) =>
      entrypoint === "get_preset" ? preset : entrypoint === "get_frontier" ? season : [token],
    );
    const result = await fundFrontier(account, provider, shard, "https://herald.test", 42, environment, "300000");
    expect(result.frontier).toMatchObject({
      presetId: 6,
      start: startsAt,
      end: endsAt,
      pool: String(210000n * 10n ** 18n),
      prizePool: String(90000n * 10n ** 18n),
    });
    expect(execute.mock.calls[0]![0]).toEqual([
      {
        contractAddress: token,
        entrypoint: "approve",
        calldata: [BigInt(ledger).toString(), String(300000n * 10n ** 18n), "0"],
      },
      {
        contractAddress: ledger,
        entrypoint: "fund_frontier",
        calldata: ledgerCall("fund_frontier", {
          shard: 7,
          season_id: 42,
          preset_id: 6,
          start: startsAt,
          end: endsAt,
          seed: 99,
          amount: { low: 300000n * 10n ** 18n, high: 0 },
        }),
      },
    ]);
  },
);

test("refuses the previously registered top-ten ledger terms for a new top-three Devcon game", async () => {
  preset[18] = "10";
  await expect(run("300000")).rejects.toThrow("frontier_funding_differs_from_game");
  expect(execute).not.toHaveBeenCalled();
});
