import { expect, it, vi } from "vitest";
import { hash, type RpcProvider } from "starknet";
import { readLedgerSlot, readRegistrationPage, rpcAt } from "./index";
const key = { chainId: "0x1", slotId: 7 };
const fixture = (count = 125) => {
  const call = vi.fn(async (request: { entrypoint: string; calldata: string[] }, _head: number) =>
    request.entrypoint === "get_slot"
      ? ["1", "1", "2", "100", "200", "0", "0", String(count), "0"]
      : [`0x${(Number(request.calldata[2]) + 1).toString(16)}`],
  );
  const block = vi.fn(async (number: number | "latest") => ({
    status: "ACCEPTED_ON_L2",
    block_number: number === "latest" ? 99 : number,
    block_hash: number === 50 ? "0x50" : "0x99",
    timestamp: number === 50 ? 90 : 110,
  }));
  const events = vi.fn(async (query: { keys: string[][] }) => ({
    events: query.keys[3]!.map((wallet) => ({
      from_address: "0x10",
      keys: [hash.getSelectorFromName("Registered"), "0x1", "7", wallet],
      data: [],
      block_number: 50,
      block_hash: "0x50",
    })),
  }));
  return {
    call,
    block,
    events,
    provider: { callContract: call, getBlock: block, getEvents: events } as unknown as RpcProvider,
  };
};
it("reads an uncapped slot through bounded wallet pages at the same confirmed head", async () => {
  const f = fixture();
  expect(await readLedgerSlot(f.provider, "0x10", key, 99)).toMatchObject({ close: 100, registeredCount: 125 });
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
  expect(second.registrations[0]).toEqual({ wallet: "0x65", registeredAt: 90 });
  expect(second.next).toBeNull();
  expect(f.call.mock.calls.every((args) => args[1] === 99)).toBe(true);
});
it("refuses changed heads, missing registration events and absent slots", async () => {
  const f = fixture(1);
  await expect(readRegistrationPage(f.provider, "0x10", { ...key, blockHash: "0xbad" })).rejects.toThrow(
    "head_changed",
  );
  f.events.mockResolvedValue({ events: [] });
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow("history_incomplete");
  f.call.mockResolvedValue(["0"]);
  await expect(readLedgerSlot(f.provider, "0x10", key, 99)).rejects.toThrow();
});
it("does not substitute a default RPC for invalid configuration", () => {
  expect(() => rpcAt("")).toThrow();
  expect(() => rpcAt("file:///tmp/rpc")).toThrow();
});
it("follows partial event pages without changing the registration head or wallet order", async () => {
  const f = fixture(2);
  const events = (await f.events({ keys: [[], [], [], ["0x1", "0x2"]] })).events;
  f.events.mockReset();
  f.events.mockResolvedValueOnce({ events: [events[1]!], continuation_token: "next" } as never);
  f.events.mockResolvedValueOnce({ events: [events[0]!] });
  expect((await readRegistrationPage(f.provider, "0x10", key)).registrations).toEqual([
    { wallet: "0x1", registeredAt: 90 },
    { wallet: "0x2", registeredAt: 90 },
  ]);
  expect(f.events).toHaveBeenLastCalledWith(
    expect.objectContaining({
      continuation_token: "next",
      to_block: { block_number: 99 },
      keys: expect.arrayContaining([["0x1", "0x2"]]),
    }),
  );
});
it("rejects a repeated event continuation token instead of looping forever", async () => {
  const f = fixture(1);
  f.events.mockResolvedValue({ events: [], continuation_token: "cycle" } as never);
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow("registration_page_cycle");
  expect(f.events).toHaveBeenCalledTimes(2);
});

it("reads absent slots for opening but never serves their registrations", async () => {
  const f = fixture(0);
  f.call.mockResolvedValue(Array(9).fill("0"));
  expect(await readLedgerSlot(f.provider, "0x10", key, 99)).toMatchObject({ exists: false });
  await expect(readRegistrationPage(f.provider, "0x10", key)).rejects.toThrow("invalid_ledger_slot");
});
