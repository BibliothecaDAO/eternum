import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { hash } from "starknet";
import { openBlitzOnLedger, refundBlitzOnLedger } from "./blitz-launch";

const rpc = vi.hoisted(() => ({
  block: vi.fn(),
  number: vi.fn(),
  events: vi.fn(),
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    getBlock: rpc.block,
    getBlockNumber: rpc.number,
    getEvents: rpc.events,
    callContract: rpc.call,
    waitForTransaction: rpc.wait,
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
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
const key = { chainId: "0x1", gameId: 7 };
const game = (cancelled = false) => ["3", "1", "9", "100", "160", "0", "0", "0x0", "1", cancelled ? "1" : "0", "0"];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, timestamp: 50 });
  rpc.number.mockResolvedValue(11);
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("opens the created shard key under the containing season's economic preset, then recognizes an identical retry", async () => {
  let opened = false;
  rpc.execute.mockImplementation(async () => {
    opened = true;
    return { transaction_hash: "0xabc" };
  });
  rpc.events.mockImplementation(async (query) => ({
    events:
      query.keys[0][0] === hash.getSelectorFromName("GameOpened")
        ? opened
          ? [
              {
                from_address: "0x10",
                keys: [hash.getSelectorFromName("GameOpened"), "0x1", "0x7"],
                data: ["9", "100", "160"],
              },
            ]
          : []
        : [{ from_address: "0x10", keys: [hash.getSelectorFromName("SeasonOpened"), "3"], data: ["9", "60", "300"] }],
  }));
  rpc.call.mockImplementation(async (query) =>
    query.entrypoint === "get_season"
      ? ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "1", "9", "60", "300", "0", "0"]
      : game(),
  );
  const open = () => Effect.runPromise(openBlitzOnLedger(credentials, key, { start: 100, end: 160 }));
  await open();
  await open();
  expect(rpc.execute).toHaveBeenCalledOnce();
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "open_game",
    calldata: ["0x1", "7", "3", "9", "100", "160"],
  });
});
it("cancels before start and automatically waits until the earliest legal abort after start", async () => {
  let cancelled = false;
  rpc.events.mockResolvedValue({
    events: [
      { from_address: "0x10", keys: [hash.getSelectorFromName("GameOpened"), "0x1", "0x7"], data: ["9", "100", "160"] },
    ],
  });
  rpc.call.mockImplementation(async () => game(cancelled));
  rpc.execute.mockImplementation(async () => {
    cancelled = true;
    return { transaction_hash: "0xabc" };
  });
  expect(await Effect.runPromise(refundBlitzOnLedger(credentials, key))).toBeNull();
  expect(rpc.execute).toHaveBeenCalledWith(expect.objectContaining({ entrypoint: "cancel_game" }));
  cancelled = false;
  rpc.execute.mockClear();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, timestamp: 120 });
  expect(await Effect.runPromise(refundBlitzOnLedger(credentials, key))).toBe(40);
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 10, timestamp: 160 });
  expect(await Effect.runPromise(refundBlitzOnLedger(credentials, key))).toBeNull();
  expect(rpc.execute).toHaveBeenCalledWith(expect.objectContaining({ entrypoint: "abort_game" }));
});
