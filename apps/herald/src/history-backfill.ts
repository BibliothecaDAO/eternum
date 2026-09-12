import { normalizeFelt, type ModelRegistry } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import type { DecodedWorldEvent, RawWorldEvent } from "./types";
import { WORLD_EVENT_SELECTORS, type WorldEventDecodeMonitor } from "./world-event-decoder";
import type { HistoryStore } from "./history-store";
import { compareWorldEvents } from "./event-position";

const HISTORY_WRITE_BATCH_SIZE = 1_000;

export const backfillHistory = async (input: {
  historyStore: HistoryStore;
  registry: ModelRegistry;
  rpc: MadaraRpc;
  decodeMonitor: WorldEventDecodeMonitor;
  toBlock: number;
}): Promise<void> => {
  const progress = await input.historyStore.historyProgress();
  const fromBlock = (progress ?? -1) + 1;
  if (fromBlock > input.toBlock) {
    await input.historyStore.completeHistoryBackfill(input.toBlock);
    return;
  }

  const eventSelectors = [WORLD_EVENT_SELECTORS.event];
  const modelSelectors = input.registry.events.map(({ manifest }) => normalizeFelt(manifest.selector));
  let carriedBlock: number | null = null;
  let carriedEvents: DecodedWorldEvent[] = [];
  let completedEvents: DecodedWorldEvent[] = [];
  let completedThroughBlock: number | null = null;
  let pages = 0;
  let previousEvent: RawWorldEvent | undefined;

  for await (const page of input.rpc.getEvents({
    worldAddress: input.registry.worldAddress,
    eventSelectors,
    modelSelectors,
    fromBlock,
    toBlock: input.toBlock,
  })) {
    pages = page.page;
    const events = [...page.events].sort(compareWorldEvents);
    for (const rawEvent of events) {
      if (previousEvent && compareWorldEvents(previousEvent, rawEvent) > 0)
        throw new Error("Madara history pages are not in chain order");
      previousEvent = rawEvent;
      const block = rawEvent.block_number;
      if (block === null) throw new Error("Confirmed history event has a null block number");
      if (carriedBlock !== null && block !== carriedBlock) {
        completedEvents.push(...carriedEvents);
        completedThroughBlock = carriedBlock;
        carriedEvents = [];
        if (completedEvents.length >= HISTORY_WRITE_BATCH_SIZE) {
          await input.historyStore.appendBackfilledEvents(completedEvents, completedThroughBlock);
          completedEvents = [];
        }
      }
      carriedBlock = block;
      const failures = input.decodeMonitor.failures;
      const event = input.decodeMonitor.decode(input.registry, rawEvent);
      if (input.decodeMonitor.failures !== failures)
        throw new Error(`History backfill could not decode block ${block}`);
      if (event?.kind === "event") carriedEvents.push(event);
    }
    if (page.page % 25 === 0) {
      console.info(JSON.stringify({ event: "herald_history_backfill_progress", page: page.page }));
    }
  }

  await input.historyStore.appendBackfilledEvents([...completedEvents, ...carriedEvents], input.toBlock);
  await input.historyStore.completeHistoryBackfill(input.toBlock);
  console.info(
    JSON.stringify({
      event: "herald_history_backfill_complete",
      fromBlock,
      pages,
      toBlock: input.toBlock,
    }),
  );
};
