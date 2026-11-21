import { beforeEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { ec } from "starknet";
import { cosigningHash, raceCosigningHash, type PayoutTerms } from "@realms-world/value-ledger";
import { createCosigner, handleCosignRequest, type CosignerConfig } from "./cosigner";
import { RelayFailure } from "./ports";

const calls = vi.hoisted(() => ({
  chain: vi.fn(),
  head: vi.fn(),
  read: vi.fn(),
  receipt: vi.fn(),
  funding: vi.fn(),
  settlement: vi.fn(),
  race: vi.fn(),
  rewards: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({ getChainId: calls.chain, getBlock: calls.head, callContract: calls.read }),
}));
vi.mock("./shard-rpc", () => ({
  ShardReader: class {
    constructor(public connection: unknown) {}
  },
}));
vi.mock("./frontier-binding", () => ({ frontierReceiptBindings: calls.funding }));
vi.mock("./shard-withdrawals", () => ({ shardWithdrawalPorts: () => ({ withdrawalReceipt: calls.receipt }) }));
vi.mock("./frontier-sweep", () => ({ frontierSettlementEvidence: calls.settlement }));
vi.mock("./race-facts", () => ({ readFinishedRace: calls.race }));
vi.mock("@realms-world/chain", async (original) => ({
  ...(await original<typeof import("@realms-world/chain")>()),
  raceRewardsBeside: calls.rewards,
}));
const key = "0x12345";
const config: CosignerConfig = {
  l2RpcUrl: "https://l2.test",
  l2ChainId: "0x1",
  ledgerAddress: "0x10",
  identityUrl: "https://identity.test",
  identityToken: "identity-read-token",
  requestToken: "request-token",
  shards: [
    {
      chainId: "0x2",
      rpcUrl: "http://127.0.0.1:8080",
      gamesAddress: "0x20",
      firstRelease: 1,
      heraldUrl: "http://127.0.0.1:8081",
    },
  ],
};
const payment: PayoutTerms = {
  kind: "pay",
  shard: "0x2",
  season: 7,
  claim: "0xabc",
  wallet: "0x123",
  amount: "17",
  rank: 0,
  count: 0,
};
const identity = vi.fn<typeof fetch>();
const wallets = {
  getAnchor: async () => undefined,
  putAnchor: async () => {},
  assertWallet: vi.fn(),
  pendingChanges: () => ({ count: 0, oldestSince: null }),
};
const postedRace = ["1", "500", "0", "1", "1000", "30", "0", "0", "0", "0"];
const racePost = { kind: "race-post" as const, shard: "0x2", season: 7, total: "30" };
const racePay = { kind: "race-pay" as const, shard: "0x2", season: 7, home: "5", wallet: "0x123", amount: "10" };
const signedBy = (signature: { r: string; s: string }, digest: string) =>
  ec.starkCurve.verify(
    new ec.starkCurve.Signature(BigInt(signature.r), BigInt(signature.s)),
    digest,
    ec.starkCurve.getPublicKey(key),
  );
const raceDomain = { chainId: "0x1", rewards: "0x30", epoch: 2 };
const run = (input: unknown = payment) => createCosigner(config, key, wallets, identity).sign(input);
beforeEach(() => {
  vi.resetAllMocks();
  calls.chain.mockResolvedValue(config.l2ChainId);
  calls.head.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, block_hash: "0xa", timestamp: 1000 });
  calls.read.mockImplementation(async ({ entrypoint }) => {
    if (entrypoint === "cosigner") return [ec.starkCurve.getStarkKey(key), "2"];
    if (entrypoint === "is_paused") return ["0"];
    if (entrypoint === "get_payment") return ["0", "7", "0", "17", "0", "0", "0", "1000"];
    if (entrypoint === "get_race") return postedRace;
    throw new Error("unexpected read");
  });
  calls.receipt.mockReturnValue(
    Effect.succeed({
      chainId: "0x2",
      seasonId: 7,
      transactionHash: "0xabc",
      account: "0x456",
      amount: "17",
      prizeRank: 0,
      prizeCount: 0,
      confirmedAt: 1000,
    }),
  );
  calls.settlement.mockResolvedValue(null);
  calls.rewards.mockReturnValue("0x30");
  calls.race.mockResolvedValue({
    total: 30n,
    rewards: [
      { home: 5n, aspect: 1, amount: 10n, owner: "0x456" },
      { home: 9n, aspect: 2, amount: 20n, owner: "0x789" },
    ],
  });
  identity.mockImplementation(async () => Response.json({ identity: { realmsId: "0x1", wallet: "0x123" } }));
});
it("serves an exact signature from independent sources in the request, without a clock delay", async () => {
  const signer = createCosigner(config, key, wallets, identity);
  const response = await handleCosignRequest(
    new Request("https://cosigner.test/sign", {
      method: "POST",
      headers: { authorization: `Bearer ${config.requestToken}` },
      body: JSON.stringify(payment),
    }),
    config,
    signer,
  );
  expect(response.status).toBe(200);
  const signature = (await response.json()) as { r: string; s: string };
  expect(
    ec.starkCurve.verify(
      new ec.starkCurve.Signature(BigInt(signature.r), BigInt(signature.s)),
      cosigningHash({ chainId: "0x1", ledger: "0x10", epoch: 2 }, payment),
      ec.starkCurve.getPublicKey(key),
    ),
  ).toBe(true);
  expect(calls.receipt).toHaveBeenCalledExactlyOnceWith("0x2", "0xabc");
  expect(wallets.assertWallet).toHaveBeenCalledExactlyOnceWith("0x456", "0x1", "0x123");
  expect(calls.funding.mock.calls[0]![0].connection).toEqual(config.shards[0]);
  expect(calls.funding.mock.calls[0]![1]()).toEqual({ rpcUrl: config.l2RpcUrl, address: config.ledgerAddress });
  expect(identity.mock.calls[0]![0].toString()).toBe(
    "https://identity.test/api/operator/payout-identity?account=0x456",
  );
  expect(identity.mock.calls[0]![1]).toMatchObject({
    headers: { authorization: "Bearer identity-read-token" },
    redirect: "manual",
  });
  expect(calls.read.mock.calls.every(([, block]) => block === 10)).toBe(true);
});
it.each([
  { amount: "18" },
  { season: 8 },
  { rank: 1, count: 1 },
  { wallet: "0x999" },
  { shard: "0x999" },
  { rpcUrl: "https://attacker.test" },
])("refuses operator-chosen terms or sources %j", async (change) => {
  await expect(run({ ...payment, ...change })).rejects.toThrow();
});
it.each(["receipt", "identity", "funding", "ledger", "key", "paused", "chain", "unconfirmed"])(
  "withholds signatures on unavailable or invalid %s",
  async (failure) => {
    if (failure === "receipt")
      calls.receipt.mockReturnValue(Effect.fail(new RelayFailure({ operation: "shard_unavailable" })));
    if (failure === "identity") identity.mockRejectedValue(new Error("identity unavailable"));
    if (failure === "funding")
      calls.funding.mockImplementation(() => {
        throw new Error("funding differs");
      });
    if (failure === "ledger") calls.read.mockRejectedValue(new Error("L2 unavailable"));
    if (failure === "key") calls.read.mockResolvedValue(["0x999", "3"]);
    if (failure === "paused")
      calls.read.mockImplementation(async ({ entrypoint }) =>
        entrypoint === "cosigner" ? [ec.starkCurve.getStarkKey(key), "2"] : ["1"],
      );
    if (failure === "chain") calls.chain.mockResolvedValue("0x999");
    if (failure === "unconfirmed") calls.head.mockResolvedValue({ status: "PRE_CONFIRMED", block_number: 10 });
    await expect(run()).rejects.toThrow();
  },
);
it("refuses paid or conflicting ledger reports", async () => {
  const read = calls.read.getMockImplementation()!;
  for (const fields of [
    ["1", "7", "0x123", "17", "0", "0", "0", "1000"],
    ["0", "7", "0", "18", "0", "0", "0", "1000"],
  ]) {
    calls.read.mockImplementation((query) => (query.entrypoint === "get_payment" ? fields : read(query)));
    await expect(run()).rejects.toThrow("cosigner_report_differs");
  }
});
it("independently verifies settlement and signs only its exact totals", async () => {
  const terms = { kind: "settle" as const, shard: "0x2", season: 7, chest: "17", prize: "3", treasuryAmount: "980" };
  const signature = await run(terms);
  expect(calls.settlement).toHaveBeenCalledExactlyOnceWith(
    config.shards[0],
    "http://127.0.0.1:8081",
    { chainId: "0x2", gameId: 7, chestWithdrawn: "17", prizeWithdrawn: "3" },
    { rpcUrl: config.l2RpcUrl, address: config.ledgerAddress },
    "980",
  );
  expect(
    ec.starkCurve.verify(
      new ec.starkCurve.Signature(BigInt(signature.r), BigInt(signature.s)),
      cosigningHash({ chainId: "0x1", ledger: "0x10", epoch: 2 }, terms),
      ec.starkCurve.getPublicKey(key),
    ),
  ).toBe(true);
  calls.settlement.mockResolvedValue("unpaid_receipts");
  await expect(run(terms)).rejects.toThrow("cosigner_settlement_differs");
});
it("rejects unauthenticated HTTP requests before reading game state", async () => {
  const response = await handleCosignRequest(
    new Request("https://cosigner.test/sign", { method: "POST", body: JSON.stringify(payment) }),
    config,
    createCosigner(config, key, wallets, identity),
  );
  expect(response.status).toBe(401);
  expect(calls.read).not.toHaveBeenCalled();
});

it.each(["rpcUrl", "heraldUrl"] as const)("refuses a public or DNS-selected %s before any request", (field) => {
  for (const endpoint of [
    "https://shard.example",
    "http://shard.example",
    "http://localhost:8080",
    "https://127.0.0.1:8080",
    "http://127.0.0.1.attacker.test:8080",
    "http://user@127.0.0.1:8080",
  ]) {
    expect(() =>
      createCosigner({ ...config, shards: [{ ...config.shards[0]!, [field]: endpoint }] }, key, wallets, identity),
    ).toThrow("cosigner_shard_requires_numeric_loopback_http");
  }
  expect(calls.chain).not.toHaveBeenCalled();
});
it("withholds the HTTP signature when the independent wallet record refuses a change", async () => {
  wallets.assertWallet.mockImplementation(() => {
    throw new Error("cosigner_wallet_change_waiting");
  });
  const response = await handleCosignRequest(
    new Request("https://cosigner.test/sign", {
      method: "POST",
      headers: { authorization: `Bearer ${config.requestToken}` },
      body: JSON.stringify(payment),
    }),
    config,
    createCosigner(config, key, wallets, identity),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "cosigning_refused" });
  expect(wallets.assertWallet).toHaveBeenCalledExactlyOnceWith("0x456", "0x1", "0x123");
});

it("signs a race total and a home's reward only as it recomputes them from its own shard", async () => {
  expect(signedBy(await run(racePost), raceCosigningHash(raceDomain, racePost))).toBe(true);
  expect(signedBy(await run(racePay), raceCosigningHash(raceDomain, racePay))).toBe(true);
  expect(calls.race).toHaveBeenCalledWith(config.shards[0], "http://127.0.0.1:8081", 7);
  expect(calls.rewards).toHaveBeenCalledWith(config.ledgerAddress);
  expect(calls.read).toHaveBeenCalledWith(
    { contractAddress: "0x30", entrypoint: "get_race", calldata: ["0x2", "7"] },
    10,
  );
  expect(wallets.assertWallet).toHaveBeenCalledExactlyOnceWith("0x456", "0x1", "0x123");
  expect(identity.mock.calls[0]![0].toString()).toBe(
    "https://identity.test/api/operator/payout-identity?account=0x456",
  );
});
it.each([
  [racePost, { total: "31" }],
  [racePost, { total: "0" }],
  [racePay, { amount: "11" }],
  [racePay, { amount: "20" }],
  [racePay, { home: "6" }],
  [racePay, { wallet: "0x999" }],
  [racePay, { shard: "0x999" }],
])("refuses race terms the relay chose %j %j", async (terms, change) => {
  await expect(run({ ...terms, ...change })).rejects.toThrow();
});
it("signs nothing for a race with no confirmed result or no rewards address", async () => {
  calls.race.mockResolvedValue(null);
  await expect(run(racePost)).rejects.toThrow("cosigner_race_unfinished");
  await expect(run(racePay)).rejects.toThrow("cosigner_race_unfinished");
  calls.race.mockRejectedValue(new Error("confirmed_herald_read_unavailable"));
  await expect(run(racePost)).rejects.toThrow("confirmed_herald_read_unavailable");
  calls.rewards.mockImplementation(() => {
    throw new Error("no race rewards address");
  });
  await expect(run(racePost)).rejects.toThrow("no race rewards address");
});
it.each([
  ["unposted", ["1", "500", "0", "0", "0", "0", "0", "0", "0", "0"]],
  ["closed", ["1", "500", "0", "1", "1000", "30", "0", "0", "0", "1"]],
  ["posted with another total", ["1", "500", "0", "1", "1000", "29", "0", "0", "0", "0"]],
])("refuses a race payment while the race is %s", async (_, season) => {
  const read = calls.read.getMockImplementation()!;
  calls.read.mockImplementation((query) => (query.entrypoint === "get_race" ? season : read(query)));
  await expect(run(racePay)).rejects.toThrow("cosigner_race_differs");
});
it("refuses a race payment to a wallet the home's owner did not link", async () => {
  identity.mockImplementation(async () => Response.json({ identity: null }));
  await expect(run(racePay)).rejects.toThrow("cosigner_wallet_differs");
});
it("signs no race terms while the ledger is paused or its key rotated", async () => {
  const read = calls.read.getMockImplementation()!;
  calls.read.mockImplementation((query) => (query.entrypoint === "is_paused" ? ["1"] : read(query)));
  await expect(run(racePost)).rejects.toThrow("cosigner_ledger_paused");
  calls.read.mockImplementation((query) => (query.entrypoint === "cosigner" ? ["0x999", "3"] : read(query)));
  await expect(run(racePay)).rejects.toThrow("cosigner_key_differs");
});
