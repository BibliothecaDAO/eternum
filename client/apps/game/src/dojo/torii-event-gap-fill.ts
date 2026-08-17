import type { Entity as ToriiEntity } from "@dojoengine/torii-wasm/types";

interface ToriiEventPage {
  items: ToriiEntity[];
  nextCursor?: string;
}

export interface ToriiEventReplayWatermark {
  timestamp: bigint;
}

interface ToriiEventGapFillInput {
  fetchPage: (cursor?: string) => Promise<ToriiEventPage>;
}

const EVENT_IDENTITY_LIMIT = 2_048;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const unwrapToriiValue = (value: unknown): unknown => (isRecord(value) && "value" in value ? value.value : value);

const parseEventTimestamp = (model: string, value: unknown): bigint => {
  if (!isRecord(value) || !("timestamp" in value)) {
    throw new Error(`Torii event ${model} is missing its timestamp`);
  }

  const timestamp = unwrapToriiValue(value.timestamp);
  if (typeof timestamp === "bigint") return timestamp;
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) return BigInt(Math.trunc(timestamp));
  if (typeof timestamp === "string" && timestamp.length > 0) return BigInt(timestamp);
  throw new Error(`Torii event ${model} has an invalid timestamp`);
};

const eventEntries = (event: ToriiEntity): Array<{ identity: string; timestamp: bigint }> =>
  Object.entries(event.models).map(([model, value]) => {
    const timestamp = parseEventTimestamp(model, value);
    return {
      identity: `${model}:${event.hashed_keys}:${timestamp}`,
      timestamp,
    };
  });

const eventTimestamp = (event: ToriiEntity): bigint =>
  eventEntries(event).reduce((latest, entry) => (entry.timestamp > latest ? entry.timestamp : latest), 0n);

/**
 * Tracks the event feed's timestamp watermark and replays the inclusive gap
 * after a replacement subscription is already listening. Torii exposes no
 * event cursor on callbacks, so identity dedupe makes the second-resolution
 * timestamp safe at the boundary.
 */
export class ToriiEventGapFill {
  private latestTimestamp = 0n;
  // This larger LRU makes replay counts accurate at the inclusive watermark;
  // the runtime's smaller FIFO remains the final double-delivery guard.
  private readonly recentIdentities = new Map<string, true>();

  constructor(private readonly input: ToriiEventGapFillInput) {}

  public async establishBaseline(): Promise<void> {
    const page = await this.input.fetchPage();
    page.items.forEach((event) => this.rememberEvent(event));
  }

  public captureWatermark(): ToriiEventReplayWatermark {
    return { timestamp: this.latestTimestamp };
  }

  public handleLiveEvent(event: ToriiEntity, handleEvent: (event: ToriiEntity) => void): void {
    this.rememberEvent(event);
    handleEvent(event);
  }

  public async replaySince(
    watermark: ToriiEventReplayWatermark,
    handleEvent: (event: ToriiEntity) => void,
  ): Promise<number> {
    const candidates = await this.fetchReplayCandidates(watermark.timestamp);
    let replayedEventCount = 0;

    candidates
      .sort((left, right) => {
        const timestampOrder = eventTimestamp(left) < eventTimestamp(right) ? -1 : 1;
        return eventTimestamp(left) === eventTimestamp(right)
          ? left.hashed_keys.localeCompare(right.hashed_keys)
          : timestampOrder;
      })
      .forEach((event) => {
        if (this.hasSeenEvent(event)) return;
        this.handleLiveEvent(event, handleEvent);
        replayedEventCount += 1;
      });

    return replayedEventCount;
  }

  private async fetchReplayCandidates(watermarkTimestamp: bigint): Promise<ToriiEntity[]> {
    const candidates: ToriiEntity[] = [];
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await this.input.fetchPage(cursor);
      const timestamps = page.items.map(eventTimestamp);
      page.items.forEach((event, index) => {
        if (timestamps[index] >= watermarkTimestamp) candidates.push(event);
      });

      const reachedWatermark = timestamps.some((timestamp) => timestamp < watermarkTimestamp);
      cursor = reachedWatermark ? undefined : page.nextCursor;
      if (cursor) {
        if (visitedCursors.has(cursor)) throw new Error(`Torii event replay cursor repeated: ${cursor}`);
        visitedCursors.add(cursor);
      }
    } while (cursor);

    return candidates;
  }

  private hasSeenEvent(event: ToriiEntity): boolean {
    const entries = eventEntries(event);
    return entries.length > 0 && entries.every(({ identity }) => this.recentIdentities.has(identity));
  }

  private rememberEvent(event: ToriiEntity): void {
    eventEntries(event).forEach(({ identity, timestamp }) => {
      if (timestamp > this.latestTimestamp) this.latestTimestamp = timestamp;
      this.recentIdentities.delete(identity);
      this.recentIdentities.set(identity, true);
    });

    while (this.recentIdentities.size > EVENT_IDENTITY_LIMIT) {
      const oldest = this.recentIdentities.keys().next().value;
      if (oldest === undefined) break;
      this.recentIdentities.delete(oldest);
    }
  }
}
