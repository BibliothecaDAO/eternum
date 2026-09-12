import { expect, it, vi } from "vitest";
import { backfillHistory } from "./history-backfill";
import type { HistoryStore } from "./history-store";
import type { MadaraRpc } from "./madara-rpc";
import type { ModelRegistry } from "./model-registry";
import { WorldEventDecodeMonitor } from "./world-event-decoder";

it("rejects a page that moves behind an earlier page before publishing completion", async () => {
  const historyStore = {
    historyProgress: async () => null,
    appendBackfilledEvents: vi.fn(),
    completeHistoryBackfill: vi.fn(),
  };
  const decodeMonitor = new WorldEventDecodeMonitor();
  vi.spyOn(decodeMonitor, "decode").mockReturnValue(undefined);
  const rpc = {
    async *getEvents() {
      for (const [page, block] of [
        [1, 2],
        [2, 1],
      ]) {
        yield {
          page,
          events: [
            { block_number: block, keys: [], data: [], transaction_hash: "0x1", transaction_index: 0, event_index: 0 },
          ],
        };
      }
    },
  };
  await expect(
    backfillHistory({
      historyStore: historyStore as unknown as HistoryStore,
      rpc: rpc as unknown as MadaraRpc,
      registry: { worldAddress: "0x123", events: [], bySelector: new Map(), persistent: [] } as ModelRegistry,
      decodeMonitor,
      toBlock: 2,
    }),
  ).rejects.toThrow("not in chain order");
  expect(historyStore.appendBackfilledEvents).not.toHaveBeenCalled();
  expect(historyStore.completeHistoryBackfill).not.toHaveBeenCalled();
});

it("does not mark a backfill complete after a decode failure", async () => {
  const warning = vi.spyOn(console, "error").mockImplementation(() => {});
  const historyStore = {
    historyProgress: async () => null,
    appendBackfilledEvents: vi.fn(),
    completeHistoryBackfill: vi.fn(),
  };
  const rpc = {
    async *getEvents() {
      yield {
        page: 1,
        events: [
          { block_number: 1, keys: [], data: [], transaction_hash: "0x1", transaction_index: 0, event_index: 0 },
        ],
      };
    },
  };
  try {
    await expect(
      backfillHistory({
        historyStore: historyStore as unknown as HistoryStore,
        rpc: rpc as unknown as MadaraRpc,
        registry: { worldAddress: "0x123", events: [], bySelector: new Map(), persistent: [] } as ModelRegistry,
        decodeMonitor: new WorldEventDecodeMonitor(),
        toBlock: 1,
      }),
    ).rejects.toThrow("could not decode block 1");
    expect(historyStore.appendBackfilledEvents).not.toHaveBeenCalled();
    expect(historyStore.completeHistoryBackfill).not.toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});
