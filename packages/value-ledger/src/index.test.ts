import { expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";
import { readLedgerGame, readRegisteredPlayers, rpcAt } from "./index";

const key = { chainId: "0x1", gameId: 7 };
it("reads the published Game and registered wallets at exactly the caller's pinned block", async () => {
  const call = vi.fn(async (request: { entrypoint: string }, _head: number) =>
    request.entrypoint === "get_game"
      ? ["1", "1", "2", "100", "200", "0", "0", "0xabc", "2", "0", "1"]
      : ["0x123", "0x456"],
  );
  const provider = { callContract: call } as unknown as RpcProvider;
  expect(await readLedgerGame(provider, "0x10", key, 99)).toMatchObject({
    start: 100,
    end: 200,
    registeredCount: 2,
    finalized: true,
    commitment: "0xabc",
  });
  expect(await readRegisteredPlayers(provider, "0x10", key, 99, 2)).toEqual([
    { wallet: "0x123", account: "0x456" },
    { wallet: "0x123", account: "0x456" },
  ]);
  expect(call.mock.calls.every((args) => args[1] === 99)).toBe(true);
});
it("refuses absent games, invalid response widths and zero registered wallets", async () => {
  const call = vi.fn(async () => ["0"]);
  const provider = { callContract: call } as unknown as RpcProvider;
  await expect(readLedgerGame(provider, "0x10", key, 99)).rejects.toThrow();
  await expect(readRegisteredPlayers(provider, "0x10", key, 99, 1)).rejects.toThrow();
});
it("does not substitute a default RPC for missing or invalid configuration", () => {
  expect(() => rpcAt("")).toThrow();
  expect(() => rpcAt("file:///tmp/rpc")).toThrow();
});
