import type { ModelRegistry } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import type { BuiltGameSnapshot, RawWorldEvent } from "./types";
import { WORLD_EVENT_SELECTORS, decodeWorldEvent } from "./world-event-decoder";
import { WorldFold } from "./world-fold";

interface BuildWorldFoldInput {
  registry: ModelRegistry;
  rpc: MadaraRpc;
  confirmedBlock?: number;
  fromBlock?: number;
  onPage?: (page: { number: number; eventCount: number }) => void;
}

interface BuiltWorldFold {
  confirmedBlock: number;
  fold: WorldFold;
  metrics: BuiltGameSnapshot["metrics"];
}

const compareEvents = (left: RawWorldEvent, right: RawWorldEvent): number =>
  left.block_number - right.block_number ||
  left.transaction_index - right.transaction_index ||
  left.event_index - right.event_index;

export const buildWorldFold = async ({
  registry,
  rpc,
  confirmedBlock,
  fromBlock = 0,
  onPage,
}: BuildWorldFoldInput): Promise<BuiltWorldFold> => {
  const toBlock = confirmedBlock ?? (await rpc.blockNumber());
  const fold = new WorldFold(registry);
  const eventSelectors = Object.values(WORLD_EVENT_SELECTORS);
  const modelSelectors = [...registry.bySelector.keys()];
  let decodedEvents = 0;
  let eventMessages = 0;
  let pages = 0;
  let storeEvents = 0;
  let previousEvent: RawWorldEvent | undefined;

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
      let event;
      try {
        event = decodeWorldEvent(registry, rawEvent);
      } catch (error) {
        const modelSelector = rawEvent.keys[1] ?? "missing";
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Unable to decode world event at block ${rawEvent.block_number}, transaction ${rawEvent.transaction_index}, event ${rawEvent.event_index}, model ${modelSelector}: ${message}`,
          { cause: error },
        );
      }
      if (!event) continue;

      decodedEvents += 1;
      if (event.kind === "event") eventMessages += 1;
      else storeEvents += 1;
      fold.apply(event);
    }
    onPage?.({ number: page.page, eventCount: page.events.length });
  }

  return {
    confirmedBlock: toBlock,
    fold,
    metrics: {
      decoded_events: decodedEvents,
      event_messages: eventMessages,
      pages,
      retained_rows: fold.retainedRowCount(),
      store_events: storeEvents,
    },
  };
};

export const buildGameSnapshot = async (
  input: BuildWorldFoldInput & { gameId: string | number | bigint },
): Promise<BuiltGameSnapshot> => {
  const { gameId, ...worldInput } = input;
  const built = await buildWorldFold(worldInput);
  return {
    snapshot: built.fold.snapshot(gameId, built.confirmedBlock),
    metrics: built.metrics,
  };
};
