import { expect, mock, test } from "bun:test";
import type { Account, RpcProvider } from "starknet";
import { resolveBlitzSeason } from "./blitz-season";
import { configureLedger } from "./ledger";
import { environments, type Inputs } from "./settings";
import type { PrivateStore } from "./private-store";
import { response } from "../../packages/value-ledger/test-support/abi";
import { ledgerAbi } from "../../packages/value-ledger/test-support/ledger-abi";
import { PublicError } from "./dates";

type Window = { start: number; end: number };
const desired = { start: 200, end: 300 };
function provider(windows: Window[], now = 100) {
  const callContract = mock(async ({ calldata }: { calldata: string[] }, head: number) => {
    expect(head).toBe(50);
    const window = windows[Number(calldata[0]) - 1];
    if (!window) throw { code: 40, message: "Ledger: unknown Blitz season" };
    return response(ledgerAbi, "get_season", {
      chest_reserve: { low: 0, high: 0 },
      participant_count: 0,
      top_count: 0,
      posted: false,
      challenged: false,
      review_until: 0,
      settlement_started: false,
      paid: { low: 0, high: 0 },
      exists: true,
      preset_id: 1,
      ...window,
      pool: { low: 0, high: 0 },
    });
  });
  return { getBlockWithTxHashes: async () => ({ block_number: 50, timestamp: now }), callContract };
}
const resolve = (rpc: ReturnType<typeof provider>) =>
  resolveBlitzSeason(rpc as unknown as RpcProvider, "0x10", desired.start, desired.end);

test("an empty ledger opens season one without a configured number", async () => {
  expect(await resolve(provider([]))).toMatchObject({ id: 1, present: false });
});
test("the exact end boundary allows the next number; matching dates reuse it", async () => {
  const windows = [{ start: 10, end: 100 }];
  const rpc = provider(windows);
  expect(await resolve(rpc)).toMatchObject({ id: 2, present: false });
  windows.push(desired);
  expect(await resolve(rpc)).toMatchObject({ id: 2, present: true });
  expect(rpc.callContract.mock.calls.slice(-3).map(([call]) => call.calldata)).toEqual([["1"], ["2"], ["3"]]);
});
test.each([
  { start: 50, end: 150 },
  { start: 150, end: 250 },
])("a running or future conflicting window %j refuses instead of allocating a number", async (window) => {
  await expect(resolve(provider([window]))).rejects.toBeInstanceOf(PublicError);
});
test("only an unknown season ends enumeration; a transport failure propagates", async () => {
  const rpc = provider([]);
  const error = { code: 429 };
  rpc.callContract.mockImplementation(async () => {
    throw error;
  });
  await expect(resolve(rpc)).rejects.toEqual(error);
});

test("a successful first setup cannot suppress opening season two", async () => {
  const windows = [{ start: 10, end: 100 }];
  const rpc = {
    ...provider(windows),
    getNonce: async () => "17",
    execute: mock(async () => {
      windows.push(desired);
      return { transaction_hash: "0xnew" };
    }),
    waitForTransaction: mock(async () => ({ execution_status: "SUCCEEDED" })),
  };
  const saved = new Map<string, unknown>([["transaction-setup.json", { nonce: "1", hash: "0xold" }]]);
  const files = {
    read: (name: string) => saved.get(name),
    write: (name: string, value: unknown) => saved.set(name, value),
  };
  const read = mock(async (operation: { entrypoint: string }) => operation.entrypoint !== "open_season");
  const iso = (seconds: number) => new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
  await configureLedger(
    rpc as unknown as Account,
    environments.dev,
    { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" },
    "0x33",
    { blitzStart: iso(desired.start), blitzEnd: iso(desired.end) } as Inputs,
    files as unknown as PrivateStore,
    read,
  );
  expect(rpc.execute).toHaveBeenCalledWith(
    [{ contractAddress: "0x10", entrypoint: "open_season", calldata: ["2", "1", "200", "300"] }],
    { nonce: "17" },
  );
  expect(saved.get("transaction-setup.json")).toEqual({ nonce: "1", hash: "0xold" });
  expect(saved.has("transaction-setup-2.json")).toBe(true);
  expect(await resolve(rpc)).toMatchObject({ id: 2, present: true });
});
