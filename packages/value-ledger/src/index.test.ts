import { absentLedgerSlot } from "../test-support/ledger-abi";
import { expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";
import { readLedgerSlot, rpcAt } from "./index";
const key = { chainId: "0x1", slotId: 7 };
const fixture = () => {
  const call = vi.fn(async (): Promise<string[]> => []);
  return { call, provider: { callContract: call } as unknown as RpcProvider };
};
it("does not substitute a default RPC for invalid configuration", () => {
  expect(() => rpcAt("")).toThrow();
  expect(() => rpcAt("file:///tmp/rpc")).toThrow();
});
it("reads an absent slot as absent", async () => {
  const f = fixture();
  f.call.mockResolvedValue(absentLedgerSlot());
  expect(await readLedgerSlot(f.provider, "0x10", key, 99)).toMatchObject({ exists: false });
});
it("does not mistake an unavailable slot read for an absent slot", async () => {
  const f = fixture();
  const error = new Error("RPC unavailable");
  f.call.mockRejectedValue(error);
  await expect(readLedgerSlot(f.provider, "0x10", key, 99)).rejects.toBe(error);
});
