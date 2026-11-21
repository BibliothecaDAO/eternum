import { beforeEach, expect, it, vi } from "vitest";
import { memoryFinalFacts } from "./final-facts";
import { settleFinishedRaces, settleRace, type RaceReceipt } from "./race-rewards";

const rpc = vi.hoisted(() => ({
  read: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  head: vi.fn(),
  finalHead: vi.fn(),
  batch: vi.fn(),
}));
const shard = vi.hoisted(() => ({ games: vi.fn(), snapshot: vi.fn(), race: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ callContract: rpc.read, waitForTransaction: rpc.wait }),
  readConfirmedLedgerHead: rpc.head,
  readFinalLedgerHead: rpc.finalHead,
}));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  rpcBatch: rpc.batch,
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: class {
    execute = rpc.execute;
  },
}));
vi.mock("./frontier-games", () => ({ readFrontierGames: shard.games }));
vi.mock("./race-facts", () => ({ readFinishedRace: shard.race }));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: shard.snapshot,
}));

const WEEK = 604_800;
const signature = { r: "0x123", s: "0x456" };
const signed = ["291", "1110"];
const ledger = {
  rpcUrl: "https://ledger.test",
  rewardsAddress: "0x40" as string | null,
  accountAddress: "0x20",
  privateKey: "0x1",
  unfundedIsFault: false,
};
const reward = (home: bigint, amount: bigint, owner: string) => ({ home, aspect: 1, amount, owner });
const race = { total: 30n, rewards: [reward(5n, 10n, "0xa5"), reward(9n, 20n, "0xa9")] };
const settlement = { chainId: "0x2", gameId: 7, race };
const season = (
  state: Partial<Record<"funded" | "pool" | "posted" | "postedAt" | "total" | "paid" | "closed", string>>,
) => {
  const fields = { funded: "1", pool: "500", posted: "0", postedAt: "0", total: "0", paid: "0", closed: "0", ...state };
  return [
    fields.funded,
    fields.pool,
    "0",
    fields.posted,
    fields.postedAt,
    fields.total,
    "0",
    fields.paid,
    "0",
    fields.closed,
  ];
};
const posted = (state: Parameters<typeof season>[0] = {}) =>
  season({ posted: "1", postedAt: "1000", total: "30", ...state });
const wallets = new Map<string, string | null>();
const receipts: RaceReceipt[] = [];
const cosigner = { postRace: vi.fn(), payRace: vi.fn() };
const ports = {
  cosigner,
  payoutWallet: vi.fn(async (owner: string) => wallets.get(owner) ?? null),
  keepReceipt: vi.fn(async (receipt: RaceReceipt) => void receipts.push(receipt)),
};
const run = (overrides: Partial<typeof ledger> = {}, owed = settlement) =>
  settleRace({ ...ledger, ...overrides }, owed, ports);
const sentCalls = () =>
  rpc.execute.mock.calls.flatMap(([calls]) => calls as { entrypoint: string; calldata: string[] }[]);
const payOf = (home: string, wallet: string, amount: string) => ({
  contractAddress: "0x40",
  entrypoint: "pay_race",
  calldata: ["2", "7", home, String(BigInt(wallet)), amount, "0", ...signed],
});
const close = { contractAddress: "0x40", entrypoint: "close_race", calldata: ["0x2", "7"] };

beforeEach(() => {
  vi.resetAllMocks();
  wallets.clear();
  wallets.set("0xa5", "0xb5").set("0xa9", "0xb9");
  receipts.length = 0;
  rpc.head.mockResolvedValue({ number: 10, hash: "0xaa", time: 2000 });
  rpc.read.mockResolvedValue(posted());
  rpc.batch.mockResolvedValue([]);
  rpc.execute.mockResolvedValue({ transaction_hash: "0x77" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  cosigner.postRace.mockResolvedValue(signature);
  cosigner.payRace.mockResolvedValue(signature);
  ports.payoutWallet.mockImplementation(async (owner: string) => wallets.get(owner) ?? null);
  ports.keepReceipt.mockImplementation(async (receipt: RaceReceipt) => void receipts.push(receipt));
});

it("posts a funded race's total once, under the co-signature, and pays nothing in that pass", async () => {
  rpc.read.mockResolvedValue(season({}));
  expect(await run()).toBeNull();
  expect(rpc.read).toHaveBeenCalledWith(
    { contractAddress: "0x40", entrypoint: "get_race", calldata: ["0x2", "7"] },
    10,
  );
  expect(cosigner.postRace).toHaveBeenCalledWith({ shard: "0x2", season: 7, total: "30" });
  expect(sentCalls()).toEqual([
    { contractAddress: "0x40", entrypoint: "post_race", calldata: ["2", "7", "30", "0", ...signed] },
  ]);
  expect(cosigner.payRace).not.toHaveBeenCalled();
});

it("pays every owed home in one transaction, then closes with an empty receipt", async () => {
  expect(await run()).toBeNull();
  expect(cosigner.payRace.mock.calls).toEqual([
    [{ shard: "0x2", season: 7, home: "5", wallet: "0xb5", amount: "10" }],
    [{ shard: "0x2", season: 7, home: "9", wallet: "0xb9", amount: "20" }],
  ]);
  expect(rpc.execute.mock.calls).toEqual([[[payOf("5", "0xb5", "10"), payOf("9", "0xb9", "20")]], [[close]]]);
  expect(receipts).toEqual([{ chainId: "0x2", gameId: 7, closedAt: 2000, unpaid: [] }]);
});

it("resumes from the rewards the class already holds and pays only the rest", async () => {
  rpc.read.mockResolvedValue(posted({ paid: "10" }));
  rpc.batch.mockResolvedValue([
    ["0xb5", "10", "0"],
    ["0x0", "0", "0"],
  ]);
  await run();
  expect(rpc.batch.mock.calls[0]!.slice(0, 2)).toEqual(["https://ledger.test", "starknet_call"]);
  expect(rpc.batch.mock.calls[0]![2].map((call: { request: { calldata: string[] } }) => call.request.calldata)).toEqual(
    [
      ["0x2", "0x7", "0x5"],
      ["0x2", "0x7", "0x9"],
    ],
  );
  expect(rpc.execute.mock.calls).toEqual([[[payOf("9", "0xb9", "20")]], [[close]]]);
});

it("skips an unfunded race on staging and reports it as a fault on production", async () => {
  rpc.read.mockResolvedValue(season({ funded: "0", pool: "0" }));
  expect(await run()).toBeNull();
  expect(await run({ rewardsAddress: null })).toBeNull();
  await expect(run({ unfundedIsFault: true })).rejects.toThrow("race_unfunded");
  await expect(run({ unfundedIsFault: true, rewardsAddress: null })).rejects.toThrow("race_unfunded");
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("refuses a total above the funded pool, and a posted total that is not its own", async () => {
  rpc.read.mockResolvedValue(season({ pool: "29" }));
  await expect(run()).rejects.toThrow("race_total_exceeds_pool");
  rpc.read.mockResolvedValue(posted({ total: "29" }));
  await expect(run()).rejects.toThrow("race_post_differs");
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("keeps a home without a payout wallet open, and pays it on a later pass once the wallet exists", async () => {
  wallets.set("0xa9", null);
  await run();
  expect(rpc.execute.mock.calls).toEqual([[[payOf("5", "0xb5", "10")]]]);
  expect(receipts).toEqual([]);
  rpc.read.mockResolvedValue(posted({ paid: "10" }));
  rpc.batch.mockResolvedValue([
    ["0xb5", "10", "0"],
    ["0x0", "0", "0"],
  ]);
  wallets.set("0xa9", "0xb9");
  rpc.execute.mockClear();
  await run();
  expect(rpc.execute.mock.calls).toEqual([[[payOf("9", "0xb9", "20")]], [[close]]]);
});

it("sweeps what is still unpaid seven days after the post, and keeps its receipt before closing", async () => {
  wallets.set("0xa5", null);
  ports.payoutWallet.mockImplementation(async (owner: string) => {
    if (owner === "0xa9") throw new Error("identity down");
    return wallets.get(owner) ?? null;
  });
  rpc.head.mockResolvedValue({ number: 10, hash: "0xaa", time: 1000 + WEEK - 1 });
  await run();
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.head.mockResolvedValue({ number: 11, hash: "0xab", time: 1000 + WEEK });
  rpc.execute.mockImplementation(async () => {
    expect(receipts).toHaveLength(1);
    return { transaction_hash: "0x77" };
  });
  await run();
  expect(receipts).toEqual([
    {
      chainId: "0x2",
      gameId: 7,
      closedAt: 1000 + WEEK,
      unpaid: [
        { home: "5", amount: "10", reason: "no_payout_wallet" },
        { home: "9", amount: "20", reason: "identity_unavailable" },
      ],
    },
  ]);
  expect(rpc.execute.mock.calls).toEqual([[[close]]]);
});

it("pays the homes the co-signer signs, reports the refusal, and does not close", async () => {
  cosigner.payRace.mockImplementation(async ({ home }: { home: string }) => {
    if (home === "5") throw new Error("cosigner_unavailable");
    return signature;
  });
  rpc.head.mockResolvedValue({ number: 10, hash: "0xaa", time: 1000 + WEEK });
  await expect(run()).rejects.toThrow("cosigner_unavailable");
  expect(rpc.execute.mock.calls).toEqual([[[payOf("9", "0xb9", "20")]]]);
  expect(receipts).toEqual([]);
});

it("sends nothing when the co-signer refuses the post", async () => {
  rpc.read.mockResolvedValue(season({}));
  cosigner.postRace.mockRejectedValue(new Error("cosigner_unavailable"));
  await expect(run()).rejects.toThrow("cosigner_unavailable");
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("pays at most twenty homes in a pass and leaves the race open for the next", async () => {
  const rewards = Array.from({ length: 25 }, (_, index) => reward(BigInt(index + 1), 1n, "0xa5"));
  rpc.read.mockResolvedValue(posted({ total: "25" }));
  await run({}, { ...settlement, race: { total: 25n, rewards } });
  expect(rpc.execute).toHaveBeenCalledTimes(1);
  expect(sentCalls().map((call) => call.calldata[2])).toEqual(
    Array.from({ length: 20 }, (_, index) => String(index + 1)),
  );
  expect(receipts).toEqual([]);
});

it("sends nothing while the ledger's node is unavailable or a transaction reverted", async () => {
  rpc.head.mockRejectedValue(new Error("ledger_head_unconfirmed"));
  await expect(run()).rejects.toThrow("ledger_head_unconfirmed");
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.head.mockResolvedValue({ number: 10, hash: "0xaa", time: 2000 });
  rpc.wait.mockResolvedValue({ isReverted: () => true, revert_reason: "Race: ledger paused" });
  await expect(run()).rejects.toThrow("race_transaction_reverted");
  expect(rpc.execute).toHaveBeenCalledTimes(1);
  expect(receipts).toEqual([]);
});

it("answers a closed race with its Ethereum-accepted block, or nothing until that block holds the close", async () => {
  rpc.finalHead.mockResolvedValue({ number: 8, hash: "0x88", time: 1500 });
  rpc.read.mockImplementation(async (_call, block) => (block === 8 ? posted() : posted({ closed: "1" })));
  expect(await run()).toBeNull();
  rpc.read.mockResolvedValue(posted({ closed: "1" }));
  expect(await run()).toEqual({ block: 8, hash: "0x88" });
  expect(rpc.execute).not.toHaveBeenCalled();
});

const connection = { chainId: "0x2", rpcUrl: "http://127.0.0.1:8080", gamesAddress: "0x20", firstRelease: 1 };
const resultSnapshot = (finished: boolean) => ({
  confirmed_block: 10,
  game_id: "7",
  models: [{ model: "RaceResult", rows: finished ? [{ key: "", value: { winner: 2, ended_at: "900" } }] : [] }],
});

it("hands a finished race to the ledger side and never reads it again once its close is final", async () => {
  shard.games.mockResolvedValue({ confirmedBlock: 10, games: [{ game_id: 7 }, { game_id: 8 }] });
  shard.snapshot.mockImplementation(async (_connection, _herald, gameId) => resultSnapshot(gameId === 7));
  shard.race.mockResolvedValue(race);
  const finals = memoryFinalFacts();
  const settle = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ block: 8, hash: "0x88" });
  await settleFinishedRaces(connection, "http://127.0.0.1:8081", finals, settle);
  await settleFinishedRaces(connection, "http://127.0.0.1:8081", finals, settle);
  expect(settle.mock.calls).toEqual([[settlement], [settlement]]);
  expect(shard.race).toHaveBeenCalledTimes(2);
  await settleFinishedRaces(connection, "http://127.0.0.1:8081", finals, settle);
  expect(settle).toHaveBeenCalledTimes(2);
  expect(shard.race).toHaveBeenCalledTimes(2);
});

it("settles no race while Herald is unavailable, and one game's failure does not hold another's", async () => {
  const finals = memoryFinalFacts();
  const settle = vi.fn().mockResolvedValue(null);
  shard.games.mockRejectedValue(new Error("herald_unavailable"));
  await expect(settleFinishedRaces(connection, "http://127.0.0.1:8081", finals, settle)).rejects.toThrow(
    "herald_unavailable",
  );
  expect(settle).not.toHaveBeenCalled();
  shard.games.mockResolvedValue({ confirmedBlock: 10, games: [{ game_id: 7 }, { game_id: 8 }] });
  shard.snapshot.mockImplementation(async (_connection, _herald, gameId) => {
    if (gameId === 7) throw new Error("herald_unavailable");
    return resultSnapshot(true);
  });
  shard.race.mockResolvedValue(race);
  await expect(settleFinishedRaces(connection, "http://127.0.0.1:8081", finals, settle)).rejects.toThrow(
    "herald_unavailable",
  );
  expect(settle.mock.calls).toEqual([[{ ...settlement, gameId: 8 }]]);
});
