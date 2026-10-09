import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ledgerBlitzRegistrations } from "./ledger-roster";

const rpc = vi.hoisted(() => ({ block: vi.fn(), call: vi.fn() }));
vi.mock("../../value-relay/src/rpc", () => ({ rpcAt: () => ({ getBlock: rpc.block, callContract: rpc.call }) }));
const key = { chainId: "0x1", gameName: "blitz-registered" };
const accountForWallet = vi.fn<() => Promise<string | null>>(async () => "0x456");
const source = () =>
  ledgerBlitzRegistrations({
    rpcUrl: "https://ledger.test",
    ledgerAddress: "0x10",
    resolveGameKey: () => Effect.succeed({ chainId: "0x1", gameId: 7 }),
    accountForWallet,
  });
const game = (start = "200") => ["1", "1", "1", start, "300", "0", "0", "0", "1", "0", "0"];
beforeEach(() => {
  vi.clearAllMocks();
  rpc.block.mockResolvedValue({ block_number: 100, block_hash: "0xabc", timestamp: 200 });
  rpc.call.mockImplementation(async (request) => (request.entrypoint === "get_game" ? game() : ["0x123"]));
  accountForWallet.mockResolvedValue("0x456");
});
it("freezes the ledger wallets and resolves the complete shard roster at one confirmed head", async () => {
  expect(await Effect.runPromise(source().readClosed(key))).toEqual({
    gameId: 7,
    blockNumber: 100,
    blockHash: "0xabc",
    registrations: [{ wallet: "0x123", account: "0x456" }],
  });
  expect(rpc.block).toHaveBeenCalledWith("latest");
  expect(rpc.call.mock.calls.every((call) => call[1] === 100)).toBe(true);
  expect(rpc.call.mock.calls[1]![0]).toMatchObject({ entrypoint: "get_registered_owner", calldata: ["0x1", "7", "0"] });
});
it("defers until the ledger closes registration", async () => {
  rpc.call.mockResolvedValue(game("290"));
  await expect(Effect.runPromise(source().readClosed(key))).rejects.toMatchObject({ secondsUntilClose: 90 });
  expect(accountForWallet).not.toHaveBeenCalled();
});
it("refuses to drop a paid wallet with no linked Realms account", async () => {
  accountForWallet.mockResolvedValue(null);
  await expect(Effect.runPromise(source().readClosed(key))).rejects.toMatchObject({
    operation: "registered_wallet_not_linked",
  });
});
it("refuses a pending head instead of freezing provisional registration", async () => {
  rpc.block.mockResolvedValue({ timestamp: 200 });
  await expect(Effect.runPromise(source().readClosed(key))).rejects.toThrow();
  expect(rpc.call).not.toHaveBeenCalled();
});
