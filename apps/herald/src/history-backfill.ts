import { normalizeFelt, type ModelRegistry } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import type { DecodedWorldEvent, RawWorldEvent } from "./types";
import { WORLD_EVENT_SELECTORS, type WorldEventDecodeMonitor } from "./world-event-decoder";
import type { HistoryStore } from "./history-store";

const HISTORY_WRITE_BATCH_SIZE = 1_000;

const compareEvents = (left: RawWorldEvent, right: RawWorldEvent): number =>
  (left.block_number ?? Number.MAX_SAFE_INTEGER) - (right.block_number ?? Number.MAX_SAFE_INTEGER) ||
  left.transaction_index - right.transaction_index ||
  left.event_index - right.event_index;

export const backfillHistory = async (input: {
  historyStore: HistoryStore;
  registry: ModelRegistry;
  rpc: MadaraRpc;
  decodeMonitor: WorldEventDecodeMonitor;
  toBlock: number;
}): Promise<void> => {
  const progress = await input.historyStore.historyProgress();
  const fromBlock = (progress ?? -1) + 1;
  if (fromBlock > input.toBlock) return;

  const eventSelectors = [WORLD_EVENT_SELECTORS.event];
  const modelSelectors = input.registry.events.map(({ manifest }) => normalizeFelt(manifest.selector));
  let carriedBlock: number | null = null;
  let carriedEvents: DecodedWorldEvent[] = [];
  let completedEvents: DecodedWorldEvent[] = [];
  let completedThroughBlock: number | null = null;
  let pages = 0;

  for await (const page of input.rpc.getEvents({
    worldAddress: input.registry.worldAddress,
    eventSelectors,
    modelSelectors,
    fromBlock,
    toBlock: input.toBlock,
  })) {
    pages = page.page;
    const events = [...page.events].sort(compareEvents);
    for (const rawEvent of events) {
      const block = rawEvent.block_number;
      if (block === null) throw new Error("Confirmed history event has a null block number");
      if (carriedBlock !== null && block !== carriedBlock) {
        completedEvents.push(...carriedEvents);
        completedThroughBlock = carriedBlock;
        carriedEvents = [];
        if (completedEvents.length >= HISTORY_WRITE_BATCH_SIZE) {
          await input.historyStore.appendEvents(completedEvents, completedThroughBlock);
          completedEvents = [];
        }
      }
      carriedBlock = block;
      const event = input.decodeMonitor.decode(input.registry, rawEvent);
      if (event?.kind === "event") carriedEvents.push(event);
    }
    if (page.page % 25 === 0) {
      console.info(JSON.stringify({ event: "herald_history_backfill_progress", page: page.page }));
    }
  }

  await input.historyStore.appendEvents([...completedEvents, ...carriedEvents], input.toBlock);
  console.info(
    JSON.stringify({
      event: "herald_history_backfill_complete",
      fromBlock,
      pages,
      toBlock: input.toBlock,
    }),
  );
};
