import { Effect } from "effect";
import { hash } from "starknet";
import { beforeEach, expect, it, vi } from "vitest";
import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import { ledgerMonitorReads, ledgerResultAdapter } from "./ledger";

const rpc = vi.hoisted(() => ({ call: vi.fn(), execute: vi.fn(), wait: vi.fn(), events: vi.fn(), head: vi.fn() }));
vi.mock("starknet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("starknet")>()),
  RpcProvider: vi.fn(function () {
    return {
      callContract: rpc.call,
      execute: rpc.execute,
      waitForTransaction: rpc.wait,
      getEvents: rpc.events,
      getBlockNumber: rpc.head,
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
const game = (finalized: boolean, commitment = "0x0") => [
  "1",
  "1",
  "1",
  "100",
  "200",
  "0",
  "0",
  commitment,
  "1",
  "0",
  finalized ? "1" : "0",
];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.head.mockResolvedValue(1000);
  rpc.wait.mockResolvedValue({ isReverted: () => false });
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
});

it("submits the published ranked result and completes an identical retry without a second write", async () => {
  const post = ledgerResultAdapter(credentials);
  rpc.call.mockResolvedValueOnce(game(false)).mockResolvedValue(game(true, result.commitment));
  await Effect.runPromise(post(result));
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "apply_results",
    calldata: ["0x1", "7", "1", "0x123", "1"],
  });
  rpc.call.mockResolvedValue(game(true, result.commitment));
  await Effect.runPromise(post(result));
  expect(rpc.execute).toHaveBeenCalledTimes(1);
});
it("refuses a previously finalized different commitment", async () => {
  rpc.call.mockResolvedValue(game(true, "0xbad"));
  await expect(Effect.runPromise(ledgerResultAdapter(credentials)(result))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("decodes confirmed payments and pins the event head across pagination", async () => {
  const selector = hash.getSelectorFromName("WithdrawalPaid");
  rpc.events
    .mockResolvedValueOnce({
      events: [{ from_address: "0x10", keys: [selector, "0x1", "0xabc"], data: ["7", "0x123", "5", "1"] }],
      continuation_token: "next",
    })
    .mockResolvedValueOnce({ events: [], continuation_token: undefined });
  const reads = ledgerMonitorReads("https://ledger.test", "0x10");
  const page = await Effect.runPromise(reads.paidClaims(null));
  expect(page.rows).toEqual([
    { chainId: "0x1", transactionHash: "0xabc", seasonId: 7, wallet: "0x123", amount: String(2n ** 128n + 5n) },
  ]);
  rpc.head.mockResolvedValue(2000);
  await Effect.runPromise(reads.paidClaims(page.next));
  expect(rpc.events.mock.calls[1]![0]).toMatchObject({ to_block: { block_number: 1000 }, continuation_token: "next" });
});
it("decodes result commitments and refuses malformed payment events", async () => {
  const reads = ledgerMonitorReads("https://ledger.test", "0x10");
  rpc.events.mockResolvedValueOnce({
    events: [
      {
        from_address: "0x10",
        keys: [hash.getSelectorFromName("ResultsApplied"), "0x1", "7"],
        data: ["1", result.commitment, "0", "0"],
      },
    ],
  });
  expect((await Effect.runPromise(reads.postedResults(null))).rows).toEqual([
    { chainId: "0x1", gameId: 7, commitment: result.commitment },
  ]);
  rpc.events.mockResolvedValueOnce({
    events: [
      {
        from_address: "0x10",
        keys: [hash.getSelectorFromName("WithdrawalPaid"), "0x1", "0xabc"],
        data: ["7", "0x123", String(2n ** 128n), "0"],
      },
    ],
  });
  await expect(Effect.runPromise(reads.paidClaims(null))).rejects.toThrow();
});

it("keeps a result queued unless the confirmed ledger state records the same commitment", async () => {
  rpc.call.mockResolvedValueOnce(game(false)).mockResolvedValue(game(true, "0xbad"));
  await expect(Effect.runPromise(ledgerResultAdapter(credentials)(result))).rejects.toThrow();
  expect(rpc.execute).toHaveBeenCalledOnce();
});
