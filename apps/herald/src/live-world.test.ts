import type { GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { describe, expect, it, vi } from "vitest";

import { GameStreamHub, type StreamSocket } from "./game-stream";
import { LiveWorld } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import type { ModelCodec, ModelRegistry } from "./model-registry";
import type { RawWorldEvent, RpcBlockWithReceipts, RpcSubscribedEvent } from "./types";
import { WORLD_EVENT_SELECTORS, WorldEventDecodeMonitor, decodeWorldEvent } from "./world-event-decoder";
import { WorldFold } from "./world-fold";

const gameModel: GameSyncModelDefinition = {
  availability: "all",
  channels: ["gamewide-entity"],
  deletion: "component",
  name: "TestModel",
  recovery: "convergent-snapshot",
  s2Scope: "game",
};

const settlementModel: GameSyncModelDefinition = {
  ...gameModel,
  name: "BlitzSettlement",
};

const codec = (definition: GameSyncModelDefinition, selector: string): ModelCodec => ({
  decodeKey: (felts) =>
    definition.name === "BlitzSettlement"
      ? { game_id: BigInt(felts[0]!), player: BigInt(felts[1]!) }
      : { game_id: BigInt(felts[0]!) },
  decodeMember: () => {
    throw new Error("Fixture has no member updates");
  },
  decodeValue: (felts) => (felts.length === 0 ? {} : { value: BigInt(felts[0]!) }),
  definition,
  manifest: {
    members: [],
    selector,
    tag: `s2-${definition.name}`,
  },
});

const gameCodec = codec(gameModel, "0x101");
const settlementCodec = codec(settlementModel, "0x102");
const registry: ModelRegistry = {
  bySelector: new Map([
    ["0x101", gameCodec],
    ["0x102", settlementCodec],
  ]),
  events: [],
  persistent: [gameCodec, settlementCodec],
  worldAddress: "0x123",
};

const setEvent = (
  model: string,
  transactionHash: string,
  data: string[],
  eventIndex = 0,
  entityId = "0xabc",
): RawWorldEvent => ({
  block_number: 12,
  data,
  event_index: eventIndex,
  keys: [WORLD_EVENT_SELECTORS.set, model, entityId],
  transaction_hash: transactionHash,
  transaction_index: 0,
});

const subscribedSet = (
  transactionHash: string,
  value: string,
  eventIndex = 0,
  entityId = "0xabc",
): RpcSubscribedEvent => ({
  ...setEvent("0x101", transactionHash, ["0x1", "0x7", "0x1", value], eventIndex, entityId),
  block_number: null,
  finality_status: "PRE_CONFIRMED",
  from_address: registry.worldAddress,
});

const replacementBlock = (): RpcBlockWithReceipts => ({
  block_number: 13,
  timestamp: 100,
  transactions: [
    {
      receipt: {
        events: [
          {
            data: ["0x1", "0x7", "0x1", "0x3"],
            from_address: registry.worldAddress,
            keys: [WORLD_EVENT_SELECTORS.set, "0x101", "0xabc"],
          },
        ],
        execution_status: "SUCCEEDED",
        finality_status: "PRE_CONFIRMED",
        transaction_hash: "0x333",
      },
      transaction: { sender_address: "0xabc", type: "INVOKE" },
    },
  ],
});

const recordingSocket = (): StreamSocket & { messages: Array<Record<string, unknown>> } => {
  const messages: Array<Record<string, unknown>> = [];
  return {
    messages,
    send: (data) => messages.push(JSON.parse(data) as Record<string, unknown>),
  };
};

const endMacrotask = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const preconfirmedReceipt = (events: RpcSubscribedEvent[]) => ({
  events: events.map((event) => ({ data: event.data, from_address: event.from_address, keys: event.keys })),
  execution_status: "SUCCEEDED",
  finality_status: "PRE_CONFIRMED",
  transaction_hash: events[0]!.transaction_hash,
});

const liveFixture = () => {
  const confirmedFold = new WorldFold(registry);
  confirmedFold.apply(decodeWorldEvent(registry, setEvent("0x101", "0x111", ["0x1", "0x7", "0x1", "0x1"]))!);
  confirmedFold.apply(decodeWorldEvent(registry, setEvent("0x102", "0x112", ["0x2", "0x7", "0xabc", "0x0"]))!);
  const block = replacementBlock();
  const rpc = {
    blockNumber: async () => 12,
    getBlockWithReceipts: async () => block,
    getEvents: async function* () {},
    getTransactionByHash: async () => ({ sender_address: "0xabc", type: "INVOKE" }),
  } as unknown as MadaraRpc;
  const live = new LiveWorld({
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: async () => undefined },
    confirmedBlock: 12,
    confirmedFold,
    decodeMonitor: new WorldEventDecodeMonitor(),
    hub: new GameStreamHub("epoch-a"),
    registry,
    rpc,
  });
  return { block, live };
};

describe("LiveWorld", () => {
  it("deduplicates hints and replaces the overlay from one pre-confirmed block read", async () => {
    const { live } = liveFixture();
    const socket = recordingSocket();
    const session = live.attach("7", socket);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });
    const hint = subscribedSet("0x222", "0x2");

    live.acceptPreconfirmedEvent(hint);
    live.acceptPreconfirmedEvent(hint);
    await live.reconcileAfterSubscribe();

    expect(socket.messages.map(({ type }) => type)).toEqual([
      "hello",
      "snapshot",
      "snapshot",
      "snapshot_end",
      "diff",
      "overlay_reset",
      "diff",
      "head",
    ]);
    const postResetDiff = socket.messages.at(-2)!;
    expect(postResetDiff).toMatchObject({ block: 13, preconfirmed: true, type: "diff" });
    expect((postResetDiff.set as Array<Record<string, unknown>>)[0]).toMatchObject({
      key: "0xabc",
      model: "TestModel",
      value: { game_id: "0x7", value: "0x3" },
    });
    expect(live.snapshot("7").models[0].rows[0].value.value).toBe("0x1");

    const attachedDuringOverlay = recordingSocket();
    const attachedSession = live.attach("7", attachedDuringOverlay);
    live.resume(attachedSession, { epoch: "", seq: 0, type: "resume" });

    expect(attachedDuringOverlay.messages.map(({ type }) => type)).toEqual([
      "hello",
      "snapshot",
      "snapshot",
      "snapshot_end",
      "diff",
    ]);
    expect(attachedDuringOverlay.messages[1]).toMatchObject({
      model: "TestModel",
      rows: [{ key: "0xabc", value: { game_id: "0x7", value: "0x1" } }],
    });
    expect(attachedDuringOverlay.messages.at(-1)).toMatchObject({
      preconfirmed: true,
      set: [{ key: "0xabc", model: "TestModel", value: { game_id: "0x7", value: "0x3" } }],
      type: "diff",
    });
  });

  it("publishes one pre-confirmed diff per transaction and game", async () => {
    const { live } = liveFixture();
    const socket = recordingSocket();
    const session = live.attach("7", socket);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });

    const first = subscribedSet("0x222", "0x2", 0);
    const second = subscribedSet("0x222", "0x3", 1, "0xdef");
    live.acceptPreconfirmedEvent(first);
    const receipt = live.acceptReceipt(preconfirmedReceipt([first, second]));
    await endMacrotask();
    expect(socket.messages.filter(({ type }) => type === "diff")).toHaveLength(0);

    live.acceptPreconfirmedEvent(second);
    await endMacrotask();
    await receipt;
    const coalescedDiffs = socket.messages.filter(({ type }) => type === "diff");
    expect(coalescedDiffs).toHaveLength(1);
    expect(coalescedDiffs[0]!.set).toHaveLength(2);

    const nextTransaction = subscribedSet("0x333", "0x4");
    live.acceptPreconfirmedEvent(nextTransaction);
    const lastTransaction = subscribedSet("0x444", "0x5", 0, "0x456");
    live.acceptPreconfirmedEvent(lastTransaction);
    expect(socket.messages.filter(({ type }) => type === "diff")).toHaveLength(2);
    const lastReceipt = live.acceptReceipt(preconfirmedReceipt([lastTransaction]));
    await endMacrotask();
    await lastReceipt;

    const diffs = socket.messages.filter(({ type }) => type === "diff");
    expect(diffs).toHaveLength(3);
    expect(diffs.every(({ preconfirmed, type }) => preconfirmed === true && type === "diff")).toBe(true);
    expect(diffs[1]!.set).toHaveLength(1);
    expect(diffs[2]!.set).toHaveLength(1);
  });

  it("ignores finalized copies of subscribed pre-confirmed events", async () => {
    const { block, live } = liveFixture();
    const socket = recordingSocket();
    const session = live.attach("7", socket);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });

    await live.reconcileAfterSubscribe();
    const boundary = socket.messages.length;
    live.acceptPreconfirmedEvent({
      ...subscribedSet("0x333", "0x3"),
      block_number: block.block_number,
      finality_status: "ACCEPTED_ON_L2",
    });
    await endMacrotask();

    expect(socket.messages).toHaveLength(boundary);
  });

  it("emits one reset and head when subscription heads repeat the reconciled block", async () => {
    const { block, live } = liveFixture();
    const socket = recordingSocket();
    const session = live.attach("7", socket);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });

    await live.reconcileAfterSubscribe();
    const boundary = socket.messages.length;
    await live.acceptSubscribedHead({ block_number: block.block_number, timestamp: block.timestamp });
    await live.acceptSubscribedHead({ block_number: block.block_number - 1, timestamp: block.timestamp });

    expect(socket.messages).toHaveLength(boundary);
    expect(socket.messages.filter(({ type }) => type === "overlay_reset")).toHaveLength(1);
    expect(socket.messages.filter(({ type }) => type === "head")).toHaveLength(1);
  });

  it("resolves a reverted receipt for a sender settled in the game", async () => {
    const { live } = liveFixture();
    const socket = recordingSocket();
    const session = live.attach("7", socket);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });

    await live.acceptReceipt({
      block_number: 13,
      events: [],
      execution_status: "REVERTED",
      finality_status: "PRE_CONFIRMED",
      revert_reason: "fixture revert",
      transaction_hash: "0x444",
    });

    expect(socket.messages.at(-1)).toMatchObject({
      block: 13,
      hash: "0x444",
      revert_reason: "fixture revert",
      status: "REVERTED",
      type: "tx",
    });
  });

  it("logs an undecodable event and keeps serving later transactions", async () => {
    const { live } = liveFixture();
    const socket = recordingSocket();
    const session = live.attach("7", socket);
    live.resume(session, { epoch: "", seq: 0, type: "resume" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    live.acceptPreconfirmedEvent({ ...subscribedSet("0xbad", "0x2", 7), data: ["0x1"] });
    const nextTransaction = subscribedSet("0x600d", "0x3");
    live.acceptPreconfirmedEvent(nextTransaction);
    const receipt = live.acceptReceipt(preconfirmedReceipt([nextTransaction]));
    await endMacrotask();
    await receipt;

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        '"event":"herald_event_decode_failed","eventIndex":7,"model":"TestModel","transactionHash":"0xbad"',
      ),
    );
    expect(socket.messages.filter(({ type }) => type === "diff")).toHaveLength(1);
    expect(socket.messages.at(-1)).toMatchObject({
      preconfirmed: true,
      set: [{ key: "0xabc", model: "TestModel", value: { game_id: "0x7", value: "0x3" } }],
      type: "diff",
    });

    log.mockRestore();
  });
});
