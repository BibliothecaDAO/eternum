import { absentLedgerSlot, ledgerAbi, ledgerCall } from "../test-support/ledger-abi";
import { response } from "../test-support/abi";
import { expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";
import { readLedgerSlot, readRegistrationPage, rpcAt } from "./index";
const key = { chainId: "0x1", slotId: 7 };
const fixture = (count = 125) => {
  const call = vi.fn(async (request: { entrypoint: string; calldata: string[] }, _head: number) => {
    if (request.entrypoint === "get_slot")
      return response(ledgerAbi, "get_slot", {
        season_id: 1,
        exists: true,
        preset_id: 2,
        close: 100,
        end: 200,
        pool: { low: 0, high: 0 },
        registered_count: count,
        cancelled: false,
      });
    if (request.entrypoint !== "get_registrations") throw new Error("unexpected entrypoint");
    const from = Number(request.calldata[2]);
    const length = Math.min(Number(request.calldata[3]), count - from);
    return response(
      ledgerAbi,
      "get_registrations",
      Array.from({ length }, (_, i) => ({ 0: from + i + 1, 1: 90 })),
    );
  });
  const block = vi.fn(async (number: number | "latest") => ({
    status: "ACCEPTED_ON_L2",
    block_number: number === "latest" ? 99 : number,
    block_hash: "0x99",
    timestamp: 110,
  }));
  return { call, block, provider: { callContract: call, getBlock: block } as unknown as RpcProvider };
};
it("reads bounded registration pages with stored link times at the same confirmed head", async () => {
  const f = fixture();
  const first = await readRegistrationPage(f.provider, "0x10", key);
  expect(first.registrations).toHaveLength(100);
  expect(first.next).toBe(100);
  const second = await readRegistrationPage(f.provider, "0x10", {
    ...key,
    from: first.next!,
    blockNumber: first.blockNumber,
    blockHash: first.blockHash,
  });
  expect(second.registrations).toHaveLength(25);
  expect(BigInt(second.registrations[0]!.wallet)).toBe(101n);
  expect(second.registrations[0]!.registeredAt).toBe(90);
  expect(second.next).toBeNull();
  expect(f.call.mock.calls.every((args) => args[1] === 99)).toBe(true);
  const request = f.call.mock.calls.find(([request]) => request.entrypoint === "get_registrations")![0];
  expect(request.calldata.map(BigInt)).toEqual(
    ledgerCall("get_registrations", { key: { shard: 1, slot_id: 7 }, from: 0, limit: 100 }).map(BigInt),
  );
});
it("reads 2000 registrations in 80 calls with no event or per-wallet/per-block scan", async () => {
  const f = fixture(2000);
  let from: number | null = 0;
  let count = 0;
  do {
    const page = await readRegistrationPage(f.provider, "0x10", { ...key, from, blockNumber: 99, blockHash: "0x99" });
    count += page.registrations.length;
    from = page.next;
  } while (from !== null);
  expect(count).toBe(2000);
  expect(f.call).toHaveBeenCalledTimes(40);
  expect(f.block).toHaveBeenCalledTimes(40);
  expect(f.call.mock.calls.filter(([request]) => request.entrypoint === "get_registrations")).toHaveLength(20);
});
it("refuses a head change before or during the page", async () => {
  const f = fixture(1);
  await expect(readRegistrationPage(f.provider, "0x10", { ...key, blockHash: "0xbad" })).rejects.toThrow(
    "head_changed",
  );
  f.block.mockResolvedValueOnce({ status: "ACCEPTED_ON_L2", block_number: 99, block_hash: "0x99", timestamp: 110 });
  f.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 99, block_hash: "0xaa", timestamp: 110 });
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow("head_changed");
});
it.each([["0"], ["1", "1"], ["1", "0", "90"], ["1", "1", "100"], ["1", "1", "-1"], ["1", "1", "90", "0"]])(
  "refuses a malformed or incomplete registration page %j",
  async (...fields) => {
    const f = fixture(1);
    const previous = f.call.getMockImplementation()!;
    f.call.mockImplementation(async (request, head) =>
      request.entrypoint === "get_registrations" ? fields : previous(request, head),
    );
    await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow();
  },
);
it("refuses duplicate wallets in the page", async () => {
  const f = fixture(2);
  const previous = f.call.getMockImplementation()!;
  f.call.mockImplementation(async (request, head) =>
    request.entrypoint === "get_registrations" ? ["2", "1", "90", "0x1", "91"] : previous(request, head),
  );
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow("duplicate_registered_wallet");
});
it("returns no roster before close or after the last registration", async () => {
  const f = fixture(1);
  expect((await readRegistrationPage(f.provider, "0x10", { ...key, from: 1 })).registrations).toEqual([]);
  f.block.mockResolvedValue({ status: "ACCEPTED_ON_L2", block_number: 99, block_hash: "0x99", timestamp: 99 });
  expect((await readRegistrationPage(f.provider, "0x10", key)).secondsUntilClose).toBe(1);
  expect(f.call.mock.calls.every(([request]) => request.entrypoint === "get_slot")).toBe(true);
});
it("does not substitute a default RPC for invalid configuration", () => {
  expect(() => rpcAt("")).toThrow();
  expect(() => rpcAt("file:///tmp/rpc")).toThrow();
});
it("reads absent slots for opening but never serves their registrations", async () => {
  const f = fixture(0);
  f.call.mockResolvedValue(absentLedgerSlot());
  expect(await readLedgerSlot(f.provider, "0x10", key, 99)).toMatchObject({ exists: false });
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow("invalid_ledger_slot");
});
it("propagates a refused registration page", async () => {
  const f = fixture(1);
  const previous = f.call.getMockImplementation()!;
  const error = new Error("Ledger: registration index out of bounds");
  f.call.mockImplementation(async (query, head) => {
    if (query.entrypoint === "get_registrations") throw error;
    return previous(query, head);
  });
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toBe(error);
});
it("does not mistake an unavailable slot read for an absent slot", async () => {
  const f = fixture(0);
  const error = new Error("RPC unavailable");
  f.call.mockRejectedValue(error);
  await expect(readLedgerSlot(f.provider, "0x10", key, 99)).rejects.toBe(error);
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toBe(error);
});
