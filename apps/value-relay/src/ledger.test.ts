import { response } from "../../../packages/value-ledger/test-support/abi";
import { ledgerAbi, ledgerCall, ledgerEvent } from "../../../packages/value-ledger/test-support/ledger-abi";
import { Effect } from "effect";
import { hash } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import { ledgerChestChanges, ledgerMonitorReads, ledgerResultAdapter, postVerifiedResult } from "./ledger";

const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
  events: vi.fn(),
  head: vi.fn(),
  block: vi.fn(),
}));
vi.mock("starknet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("starknet")>()),
  RpcProvider: vi.fn(function () {
    return {
      callContract: rpc.call,
      execute: rpc.execute,
      waitForTransaction: rpc.wait,
      getEvents: rpc.events,
      getBlockNumber: rpc.head,
      getBlock: rpc.block,
    };
  }),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const credentials = {
  rpcUrl: "https://ledger.test",
  contractAddress: "0x10",
  accountAddress: "0x20",
  privateKey: "unused-test-key",
};
const result = {
  chainId: "0x1",
  gameId: 7,
  rows: [{ wallet: "0x123", rank: 1 }],
  commitment: "",
};
result.commitment = blitzCommitment(result);
const game = (finalized: boolean, commitment = "0x0") => [finalized ? commitment : "0x0"];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.head.mockResolvedValue(1000);
  rpc.block.mockImplementation(async (number) => ({
    status: "ACCEPTED_ON_L2",
    block_number: number === "latest" ? 1000 : number,
    block_hash: "0xa",
    timestamp: 1000,
  }));
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
});

it("submits the published ranked result and completes an identical retry without a second write", async () => {
  const post = ledgerResultAdapter(credentials, 12);
  rpc.call.mockResolvedValueOnce(game(false)).mockResolvedValue(game(true, result.commitment));
  await Effect.runPromise(post(result));
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "apply_results",
    calldata: ["0x1", "12", "7", "1", "0x123", "1"],
  });
  expect(rpc.execute.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("apply_results", {
      key: { shard: result.chainId, slot_id: 12 },
      game_id: result.gameId,
      ranked: result.rows,
    }).map(BigInt),
  );
  rpc.call.mockResolvedValue(game(true, result.commitment));
  await Effect.runPromise(post(result));
  expect(rpc.execute).toHaveBeenCalledTimes(1);
});
it("refuses a previously finalized different commitment", async () => {
  rpc.call.mockResolvedValue(game(true, "0xbad"));
  await expect(Effect.runPromise(ledgerResultAdapter(credentials, 12)(result))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("decodes confirmed payments and pins the event head across pagination", async () => {
  rpc.events
    .mockResolvedValueOnce({
      events: [
        {
          from_address: "0x10",
          transaction_hash: "0xdef",
          block_number: 100,
          block_hash: "0xa",
          ...ledgerEvent("WithdrawalPaid", {
            shard: 1,
            claim_id: "0xabc",
            season_id: 7,
            wallet: "0x123",
            amount: { low: 5, high: 1 },
          }),
        },
      ],
      continuation_token: "next",
    })
    .mockResolvedValueOnce({ events: [], continuation_token: undefined });
  const reads = ledgerMonitorReads("https://ledger.test", "0x10", "staging");
  const page = await Effect.runPromise(reads.paidClaims(null));
  expect(page.rows).toEqual([
    {
      chainId: "0x1",
      transactionHash: "0xabc",
      seasonId: 7,
      wallet: "0x123",
      paymentTransactionHash: "0xdef",
      paidAt: 1000,
      amount: String(2n ** 128n + 5n),
    },
  ]);
  rpc.head.mockResolvedValue(2000);
  await Effect.runPromise(reads.paidClaims(page.next));
  expect(rpc.events.mock.calls[1]![0]).toMatchObject({ to_block: { block_number: 1000 }, continuation_token: "next" });
});
it("keeps only its own environment's rows of the ledger dev and production share, at their page positions", async () => {
  const chainOf = (name: string) => `0x${Buffer.from(name, "ascii").toString("hex")}`;
  const dev = chainOf("DEV_18dfa7f2b475f083");
  const production = chainOf("PRODUCTION_18e0000000000000");
  const paid = (shard: string, claim: string) => ({
    from_address: "0x10",
    transaction_hash: "0xdef",
    block_number: 100,
    block_hash: "0xa",
    ...ledgerEvent("WithdrawalPaid", {
      shard,
      claim_id: claim,
      season_id: 7,
      wallet: "0x123",
      amount: { low: 5, high: 0 },
    }),
  });
  const applied = (shard: string, gameId: number) => ({
    from_address: "0x10",
    transaction_hash: "0xdef",
    ...ledgerEvent("ResultsApplied", {
      key: { shard, game_id: gameId },
      slot_id: 12,
      season_id: 1,
      result_commitment: result.commitment,
      pool: { low: 0, high: 0 },
    }),
  });
  const pages = { events: [paid(dev, "0xa1"), paid(production, "0xa2"), paid("0x1", "0xa3")] };
  const results = { events: [applied(production, 7), applied(dev, 8)] };
  const claims = async (environment: "staging" | "production") => {
    rpc.events.mockResolvedValueOnce(pages);
    const page = await Effect.runPromise(
      ledgerMonitorReads("https://ledger.test", "0x10", environment).paidClaims(null),
    );
    return page.rows.map((row) => row.transactionHash);
  };
  expect(await claims("staging")).toEqual(["0xa1", "0xa3"]);
  expect(await claims("production")).toEqual(["0xa2", "0xa3"]);
  rpc.events.mockResolvedValueOnce(results);
  const posted = await Effect.runPromise(
    ledgerMonitorReads("https://ledger.test", "0x10", "production").postedResults(null),
  );
  expect(posted.rows.map((row) => [BigInt(row.chainId), row.gameId])).toEqual([[BigInt(production), 7]]);
});
it("decodes result commitments and refuses malformed payment events", async () => {
  const reads = ledgerMonitorReads("https://ledger.test", "0x10", "staging");
  expect(rpc.call).not.toHaveBeenCalled();
  rpc.events.mockResolvedValueOnce({
    events: [
      {
        from_address: "0x10",
        transaction_hash: "0xdef",
        ...ledgerEvent("ResultsApplied", {
          key: { shard: 1, game_id: 7 },
          slot_id: 12,
          season_id: 1,
          result_commitment: result.commitment,
          pool: { low: 0, high: 0 },
        }),
      },
    ],
  });
  expect((await Effect.runPromise(reads.postedResults(null))).rows).toEqual([
    { chainId: "0x1", gameId: 7, commitment: result.commitment },
  ]);
  expect(rpc.call).not.toHaveBeenCalled();
  rpc.events.mockResolvedValueOnce({
    events: [
      {
        from_address: "0x10",
        transaction_hash: "0xdef",
        keys: [hash.getSelectorFromName("WithdrawalPaid"), "0x1", "0xabc"],
        data: ["7", "0x123", String(2n ** 128n), "0"],
      },
    ],
  });
  await expect(Effect.runPromise(reads.paidClaims(null))).rejects.toThrow();
});

it("keeps a result queued unless the confirmed ledger state records the same commitment", async () => {
  rpc.call.mockResolvedValueOnce(game(false)).mockResolvedValue(game(true, "0xbad"));
  await expect(Effect.runPromise(ledgerResultAdapter(credentials, 12)(result))).rejects.toThrow();
  expect(rpc.execute).toHaveBeenCalledOnce();
});

it("reads the funded deposit through the committed ledger ABI at a confirmed head", async () => {
  const pool = 123n * 10n ** 18n;
  rpc.call.mockResolvedValue(
    response(ledgerAbi, "get_frontier", {
      funded: true,
      start: 10,
      end: 110,
      pool: { low: pool, high: 0 },
      paid: { low: 0, high: 0 },
      closed: false,
      preset_id: 2,
      seed: 153,
    }),
  );
  expect(
    await Effect.runPromise(
      ledgerMonitorReads(credentials.rpcUrl, credentials.contractAddress, "staging").frontierPool("0x1", 7),
    ),
  ).toBe(String(pool));
  expect(rpc.call).toHaveBeenCalledWith(
    { contractAddress: "0x10", entrypoint: "get_frontier", calldata: ["0x1", "7"] },
    1000,
  );
  rpc.call.mockRejectedValue(new Error("Ledger: unknown Frontier season"));
  await expect(
    Effect.runPromise(
      ledgerMonitorReads(credentials.rpcUrl, credentials.contractAddress, "staging").frontierPool("0x1", 7),
    ),
  ).rejects.toMatchObject({ operation: "read ledger Frontier pool" });
});

const unpostedResult = { chainId: "0x1", gameId: 9, rows: [{ wallet: "0x456", rank: 1 }], commitment: "0x1" };
it("posts a verified paid result for the slot that paid for it", async () => {
  const post = vi.fn(() => Effect.void);
  const postFor = vi.fn(() => post);
  await postVerifiedResult(unpostedResult, async () => 4, postFor);
  expect(postFor).toHaveBeenCalledWith(4);
  expect(post).toHaveBeenCalledWith(unpostedResult);
});
it("completes a result outside any slot without posting it to the ledger", async () => {
  const postFor = vi.fn();
  await expect(postVerifiedResult(unpostedResult, async () => null, postFor)).resolves.toBeUndefined();
  expect(postFor).not.toHaveBeenCalled();
});
it("leaves a result whose slot cannot be verified unposted and failing, so the relay retries it", async () => {
  const postFor = vi.fn();
  await expect(
    postVerifiedResult(
      unpostedResult,
      async () => {
        throw new Error("paid_game_slot_missing");
      },
      postFor,
    ),
  ).rejects.toThrow("paid_game_slot_missing");
  expect(postFor).not.toHaveBeenCalled();
});

it("rediscovers a chest request inserted behind the cursor by an L2 rewrite", async () => {
  const request = {
    from_address: "0x10",
    transaction_hash: "0x123",
    block_number: 1000,
    block_hash: "0xa",
    keys: [hash.getSelectorFromName("ChestRequested"), "7", "0", "0x123"],
    data: ["1000"],
  };
  rpc.events.mockImplementation(async ({ from_block }) => ({
    events: from_block.block_number <= 1000 ? [request] : [],
  }));
  const page = await Effect.runPromise(
    ledgerChestChanges("https://ledger.test", "0x10", 1001, null, { number: 1000, hash: "0xdead" }),
  );
  expect(page.rows).toEqual([{ kind: "requested", request: { tokenId: "7", requester: "0x123", requestBlock: 1000 } }]);
  expect(page.rewind).toBe(true);
});

it("refuses a ledger event page whose head changes while it is read", async () => {
  rpc.events.mockImplementation(async () => {
    rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 1000, block_hash: "0xb", timestamp: 1000 });
    return { events: [] };
  });
  await expect(Effect.runPromise(ledgerChestChanges("https://ledger.test", "0x10", 0, null))).rejects.toThrow();
});

it("restarts pagination on a replaced checkpoint and anchors an old cursor by replaying it once", async () => {
  const reads = ledgerMonitorReads("https://ledger.test", "0x10", "staging");
  rpc.events.mockResolvedValue({ events: [], continuation_token: "next" });
  const first = await Effect.runPromise(reads.postedResults(null));
  rpc.block.mockImplementation(async (number) => ({
    status: "ACCEPTED_ON_L2",
    block_number: number === "latest" ? 1001 : number,
    block_hash: "0xb",
    timestamp: 1001,
  }));
  const replay = await Effect.runPromise(reads.postedResults(first.next, 0, first.anchor));
  expect(replay).toMatchObject({ rewind: true, head: 1001, anchor: { number: 1001, hash: "0xb" } });
  expect(rpc.events.mock.calls[1]![0]).not.toHaveProperty("continuation_token");
  expect(rpc.events.mock.calls[1]![0].from_block).toEqual({ block_number: 0 });
  const legacy = await Effect.runPromise(reads.postedResults(JSON.stringify({ head: 999, token: "old" }), 900));
  expect(legacy.rewind).toBe(true);
  rpc.events.mockResolvedValue({ events: [] });
  const resumed = await Effect.runPromise(reads.postedResults(legacy.next, 0, legacy.anchor));
  expect(resumed.rewind).toBe(false);
  expect(rpc.events.mock.calls.at(-1)![0].continuation_token).toBe("next");
});
