import type { ModelRegistry } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import type { BuiltGameSnapshot, DecodedWorldEvent, FoldChange, RawWorldEvent, ReplayMetrics } from "./types";
import { WORLD_EVENT_SELECTORS, WorldEventDecodeMonitor } from "./world-event-decoder";
import { WorldFold } from "./world-fold";

interface ReplayWorldEventsInput {
  fold?: WorldFold;
  registry: ModelRegistry;
  rpc: MadaraRpc;
  fromBlock: number;
  toBlock: number;
  applyAtomically?: boolean;
  onPage?: (page: { number: number; eventCount: number }) => void;
  onChange?: (event: DecodedWorldEvent, change: FoldChange | undefined) => void;
  decodeMonitor?: WorldEventDecodeMonitor;
}

interface BuildWorldFoldInput extends Omit<ReplayWorldEventsInput, "fromBlock" | "toBlock"> {
  confirmedBlock?: number;
  fromBlock?: number;
}

interface BuiltWorldFold {
  confirmedBlock: number;
  fold: WorldFold;
  metrics: BuiltGameSnapshot["metrics"];
}

const compareEvents = (left: RawWorldEvent, right: RawWorldEvent): number =>
  (left.block_number ?? Number.MAX_SAFE_INTEGER) - (right.block_number ?? Number.MAX_SAFE_INTEGER) ||
  left.transaction_index - right.transaction_index ||
  left.event_index - right.event_index;

export const replayWorldEvents = async ({
  registry,
  rpc,
  fold: existingFold,
  fromBlock,
  toBlock,
  onPage,
  onChange,
  decodeMonitor = new WorldEventDecodeMonitor(),
  applyAtomically = false,
}: ReplayWorldEventsInput): Promise<{ fold: WorldFold; metrics: Omit<ReplayMetrics, "retained_rows"> }> => {
  const fold = existingFold ?? new WorldFold(registry);
  const eventSelectors = Object.values(WORLD_EVENT_SELECTORS);
  const modelSelectors = [...registry.bySelector.keys()];
  let decodedEvents = 0;
  let eventMessages = 0;
  let pages = 0;
  let storeEvents = 0;
  let previousEvent: RawWorldEvent | undefined;
  const deferredEvents: DecodedWorldEvent[] = [];

  const applyEvent = (event: DecodedWorldEvent): void => {
    const change = fold.apply(event);
    onChange?.(event, change);
  };

  if (fromBlock > toBlock) {
    return {
      fold,
      metrics: { decoded_events: 0, event_messages: 0, pages: 0, store_events: 0 },
    };
  }

  for await (const page of rpc.getEvents({
    worldAddress: registry.worldAddress,
    eventSelectors,
    modelSelectors,
    fromBlock,
    toBlock,
  })) {
    pages = page.page;
    const events = [...page.events].sort(compareEvents);
    for (const rawEvent of events) {
      if (previousEvent && compareEvents(previousEvent, rawEvent) > 0) {
        throw new Error("Madara getEvents pages are not in chain order");
      }
      previousEvent = rawEvent;
      const event = decodeMonitor.decode(registry, rawEvent);
      if (!event) continue;

      decodedEvents += 1;
      if (event.kind === "event") eventMessages += 1;
      else storeEvents += 1;
      if (applyAtomically) deferredEvents.push(event);
      else applyEvent(event);
    }
    onPage?.({ number: page.page, eventCount: page.events.length });
  }

  deferredEvents.forEach(applyEvent);

  return {
    fold,
    metrics: {
      decoded_events: decodedEvents,
      event_messages: eventMessages,
      pages,
      store_events: storeEvents,
    },
  };
};

export const buildWorldFold = async ({
  registry,
  rpc,
  confirmedBlock,
  fold,
  fromBlock = 0,
  onPage,
  onChange,
  decodeMonitor,
}: BuildWorldFoldInput): Promise<BuiltWorldFold> => {
  const toBlock = confirmedBlock ?? (await rpc.blockNumber());
  const replayed = await replayWorldEvents({
    decodeMonitor,
    fold,
    fromBlock,
    onChange,
    onPage,
    registry,
    rpc,
    toBlock,
  });
  return {
    confirmedBlock: toBlock,
    fold: replayed.fold,
    metrics: { ...replayed.metrics, retained_rows: replayed.fold.retainedRowCount() },
  };
};
