import { GAME_SYNC_MODEL_MANIFEST } from "@bibliothecadao/eternum/game-sync-models";
import { afterEach, expect, it, vi } from "vitest";
import type { ModelCodec, ModelRegistry } from "./model-registry";
import type { MadaraRpc } from "./madara-rpc";
import type { RawWorldEvent } from "./types";
import { replayWorldEvents } from "./snapshot-builder";
import { WORLD_EVENT_SELECTORS, WorldEventDecodeMonitor } from "./world-event-decoder";

const codec: ModelCodec = {
  definition: GAME_SYNC_MODEL_MANIFEST.find((model) => model.name === "StoryEvent")!,
  manifest: { tag: "s2-StoryEvent", selector: "0x123", members: [] },
  decodeKey: () => ({ game_id: 7 }),
  decodeValue: () => ({ timestamp: 1, story: { RealmCreatedStory: {} } }),
  decodeMember: () => {
    throw new Error("Not a store member");
  },
};
const registry: ModelRegistry = {
  bySelector: new Map([["0x123", codec]]),
  worldAddress: "0x456",
  events: [codec],
  persistent: [],
};
const raw: RawWorldEvent = {
  block_number: 1,
  transaction_hash: "0xabc",
  transaction_index: 0,
  event_index: 0,
  keys: [WORLD_EVENT_SELECTORS.event, "0x123", "0x1"],
  data: ["0x0", "0x0"],
};
const malformed = { ...raw, data: ["0x5"] };
afterEach(() => vi.restoreAllMocks());

it("reports incomplete history when a confirmed record cannot be decoded", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const rpc = {
    async *getEvents() {
      yield { events: [malformed], page: 1 };
    },
  } as unknown as MadaraRpc;
  const replayed = await replayWorldEvents({ registry, rpc, fromBlock: 1, toBlock: 1 });
  expect(replayed.decodedCompletely).toBe(false);
  expect(replayed.metrics.event_messages).toBe(0);
});

it("does not confuse an unrelated concurrent decode failure with this confirmed range", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const decodeMonitor = new WorldEventDecodeMonitor();
  const rpc = {
    async *getEvents() {
      decodeMonitor.decode(registry, malformed);
      await Promise.resolve();
      yield { events: [raw], page: 1 };
    },
  } as unknown as MadaraRpc;
  const replayed = await replayWorldEvents({ registry, rpc, decodeMonitor, fromBlock: 1, toBlock: 1 });
  expect(decodeMonitor.failures).toBe(1);
  expect(replayed.decodedCompletely).toBe(true);
  expect(replayed.metrics.event_messages).toBe(1);
});
