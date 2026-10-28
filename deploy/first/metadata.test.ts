import { expect, mock, test } from "bun:test";
import type { Account, RpcProvider } from "starknet";
import { configureLedger, setupCalls, setupPresenceReader } from "./ledger";
import { environments, type Inputs } from "./settings";
import type { PrivateStore } from "./private-store";
/** A Blitz season window for the environments that run Blitz. */
const BLITZ_WINDOW = { start: 4000, end: 9000, seasonId: 1 };

const assets = { ledger: "0x10", lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" };
const calls = setupCalls(environments.dev, assets, "0x33", 5, BLITZ_WINDOW);
const metadata = calls.filter((call) => call.entrypoint === "set_attrs_raw_to_ipfs_cid");
const head = 16_200_000;

test.each([0, 1, 16_199_997, head])(
  "metadata scans start at deployment block %i, searched once per collection",
  async (deployed) => {
    const getClassHashAt = mock(async (_address: string, block: number) => {
      if (block < deployed) throw { code: 20 };
      return "0xabc";
    });
    const getEvents = mock(async (_request: { from_block: { block_number: number } }) => ({ events: [] }));
    const read = setupPresenceReader({ getClassHashAt, getEvents } as unknown as RpcProvider);
    await Promise.all(metadata.map((call) => read(call, head)));
    const searches = getClassHashAt.mock.calls.length;
    expect(searches).toBeLessThanOrEqual(52);
    expect(getClassHashAt.mock.calls.filter(([, block]) => block === head)).toHaveLength(2);
    expect(getEvents.mock.calls.every(([request]) => request.from_block.block_number === deployed)).toBe(true);
    expect(getEvents).toHaveBeenCalledTimes(metadata.length);
    await Promise.all(metadata.map((call) => read(call, head + 1)));
    expect(getClassHashAt.mock.calls).toHaveLength(searches);
  },
);

test.each([20, 24, 429])(
  "a missing contract at the head or another head failure (%i) refuses scanning",
  async (code) => {
    const failure = { code };
    const getEvents = mock(async () => ({ events: [] }));
    const read = setupPresenceReader({
      getClassHashAt: async () => {
        throw failure;
      },
      getEvents,
    } as unknown as RpcProvider);
    await expect(read(metadata[0]!, head)).rejects.toEqual(failure);
    expect(getEvents).not.toHaveBeenCalled();
  },
);

test("a historical read error other than contract-not-found stops the search", async () => {
  const failure = { code: 429 };
  const getEvents = mock(async () => ({ events: [] }));
  const read = setupPresenceReader({
    getClassHashAt: async (_address: string, block: number) => {
      if (block !== head) throw failure;
      return "0xabc";
    },
    getEvents,
  } as unknown as RpcProvider);
  await expect(read(metadata[0]!, head)).rejects.toEqual(failure);
  expect(getEvents).not.toHaveBeenCalled();
});

test("apply starts every presence read together", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = mock(async () => {
    await gate;
    return true;
  });
  const pending = configureLedger(
    {
      getBlockWithTxHashes: async () => ({ block_number: head, timestamp: 1 }),
      callContract: async () => {
        throw { code: 40, message: "Ledger: unknown Blitz season" };
      },
    } as unknown as Account,
    environments.dev,
    assets,
    "0x33",
    { blitzStart: "2027-01-01T00:00:00Z", blitzEnd: "2027-02-01T00:00:00Z", frontierPresetId: "5" } as Inputs,
    {} as PrivateStore,
    () => {},
    read,
  );
  await Bun.sleep(0);
  try {
    expect(read).toHaveBeenCalledTimes(calls.length);
  } finally {
    release();
  }
  expect(await pending).toBe(true);
});
