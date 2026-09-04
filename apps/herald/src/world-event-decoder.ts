import { hash } from "starknet";

import { normalizeFelt, type ModelRegistry } from "./model-registry";
import type { DecodedWorldEvent, EventPosition, Felt, RawWorldEvent } from "./types";

export const WORLD_EVENT_SELECTORS = {
  delete: normalizeFelt(hash.getSelectorFromName("StoreDelRecord")),
  event: normalizeFelt(hash.getSelectorFromName("EventEmitted")),
  set: normalizeFelt(hash.getSelectorFromName("StoreSetRecord")),
  update: normalizeFelt(hash.getSelectorFromName("StoreUpdateRecord")),
  updateMember: normalizeFelt(hash.getSelectorFromName("StoreUpdateMember")),
} as const;

const eventPosition = (event: RawWorldEvent): EventPosition => ({
  blockNumber: event.block_number,
  transactionHash: normalizeFelt(event.transaction_hash),
  transactionIndex: event.transaction_index,
  eventIndex: event.event_index,
});

const readSpan = (felts: Felt[], offset: number): { values: Felt[]; nextOffset: number } => {
  if (offset >= felts.length) throw new Error("Store event payload ended before its span length");
  const length = Number(BigInt(felts[offset]));
  if (!Number.isSafeInteger(length) || length < 0) throw new Error(`Invalid Store event span length ${felts[offset]}`);
  const nextOffset = offset + 1 + length;
  if (nextOffset > felts.length) {
    throw new Error(`Store event declared ${length} felts but only ${felts.length - offset - 1} remain`);
  }
  return { values: felts.slice(offset + 1, nextOffset), nextOffset };
};

const readOnlySpan = (event: RawWorldEvent): Felt[] => {
  const span = readSpan(event.data, 0);
  if (span.nextOffset !== event.data.length) throw new Error("Store event has data after its value span");
  return span.values;
};

const readKeyAndValueSpans = (event: RawWorldEvent): { keys: Felt[]; values: Felt[] } => {
  const keys = readSpan(event.data, 0);
  const values = readSpan(event.data, keys.nextOffset);
  if (values.nextOffset !== event.data.length) throw new Error("Store event has data after its key and value spans");
  return { keys: keys.values, values: values.values };
};

export const decodeWorldEvent = (registry: ModelRegistry, event: RawWorldEvent): DecodedWorldEvent | undefined => {
  const eventSelector = event.keys[0] ? normalizeFelt(event.keys[0]) : undefined;
  const modelSelector = event.keys[1] ? normalizeFelt(event.keys[1]) : undefined;
  const entityId = event.keys[2] ? normalizeFelt(event.keys[2]) : undefined;
  if (!eventSelector || !modelSelector || !entityId) throw new Error("World event is missing selector keys");

  const codec = registry.bySelector.get(modelSelector);
  if (!codec) return undefined;
  const base = { entityId, model: codec.definition, position: eventPosition(event) };

  if (eventSelector === WORLD_EVENT_SELECTORS.set) {
    const spans = readKeyAndValueSpans(event);
    return {
      ...base,
      kind: "set",
      key: codec.decodeKey(spans.keys, "store"),
      value: codec.decodeValue(spans.values, "store"),
    };
  }
  if (eventSelector === WORLD_EVENT_SELECTORS.update) {
    return { ...base, kind: "update", value: codec.decodeValue(readOnlySpan(event), "store") };
  }
  if (eventSelector === WORLD_EVENT_SELECTORS.updateMember) {
    const memberSelector = event.keys[3];
    if (!memberSelector) throw new Error("StoreUpdateMember is missing its member selector");
    const member = codec.decodeMember(memberSelector, readOnlySpan(event));
    return { ...base, kind: "update-member", ...member };
  }
  if (eventSelector === WORLD_EVENT_SELECTORS.delete) {
    if (event.data.length !== 0) throw new Error("StoreDelRecord unexpectedly contains data");
    return { ...base, kind: "delete" };
  }
  if (eventSelector === WORLD_EVENT_SELECTORS.event) {
    const spans = readKeyAndValueSpans(event);
    // world.emit_event serializes with Cairo serde, not the store layout (README "herald encodings").
    return {
      ...base,
      kind: "event",
      key: codec.decodeKey(spans.keys, "serde"),
      value: codec.decodeValue(spans.values, "serde"),
    };
  }
  return undefined;
};

const resolveFailedModel = (registry: ModelRegistry, event: RawWorldEvent): string => {
  const selector = event.keys[1];
  if (!selector) return "missing";

  try {
    return registry.bySelector.get(normalizeFelt(selector))?.definition.name ?? selector;
  } catch {
    return selector;
  }
};

export class WorldEventDecodeMonitor {
  private failureCount = 0;

  public get failures(): number {
    return this.failureCount;
  }

  public decode(registry: ModelRegistry, event: RawWorldEvent): DecodedWorldEvent | undefined {
    try {
      return decodeWorldEvent(registry, event);
    } catch (error) {
      this.failureCount += 1;
      console.error(
        JSON.stringify({
          block: event.block_number,
          error: error instanceof Error ? error.message : String(error),
          event: "herald_event_decode_failed",
          eventIndex: event.event_index,
          model: resolveFailedModel(registry, event),
          transactionHash: event.transaction_hash,
          transactionIndex: event.transaction_index,
        }),
      );
      return undefined;
    }
  }
}
