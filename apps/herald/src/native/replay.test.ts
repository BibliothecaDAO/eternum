import { presetRegistration, presetLaunch } from "./preset-fixtures";
import { storyEventIdentity } from "@bibliothecadao/eternum/game-sync";
import { toJsonValue } from "../model-registry";
import { createNativeWorldIngestion } from "./world-ingestion";
import { loadNativeWorld } from "./load";
import { describe, expect, it, vi } from "vitest";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import deleted from "../../../../contracts/l3/world-native/schema/fixtures/row-deleted.json";
import malformed from "../../../../contracts/l3/world-native/schema/fixtures/malformed-row.json";
import { DiffLatencyMonitor } from "../diff-latency";
import { LiveWorld } from "../live-world";
import { WorldFold } from "../world-fold";
import { createHeraldRequestHandler } from "../http";
import type { MadaraRpc } from "../madara-rpc";
import type { RpcEvent, RpcBlockWithReceipts } from "../types";
import { battleEvent, pointsAward, receipt, schema, setup, rowEvent, shardManifest } from "./fixtures";

function block(number: number, events: RpcEvent[]): RpcBlockWithReceipts {
  return {
    block_number: number,
    timestamp: 2160,
    transactions: [{ receipt: receipt(events, `0x${number.toString(16)}`), transaction: { type: "INVOKE" } }],
  };
}
function wireHistory() {
  const events = [setFixture.raw, pointsAward("1", "0x111", "100", "100", "100")];
  const preset = presetRegistration(2);
  const launched = block(10, [preset.event, ...presetLaunch(preset, 1, 1800), ...events]);
  launched.transactions[0]!.transaction.calldata = preset.calldata;
  return [launched, block(11, [setFixture.raw]), block(12, [deleted.raw]), block(13, [setFixture.raw])];
}
const metrics = { decoded_events: 1, event_messages: 0, pages: 1, store_events: 1, retained_rows: 1 };

describe("native confirmed replay and transaction delivery", () => {
  it("rebuilds native event fixtures through deletes and a checkpoint reconnect", async () => {
    const { native, decoder, fold } = setup();
    const history = wireHistory();
    const rpc = { getBlockWithReceipts: vi.fn(async (number: number) => history[number - 10]) };
    await native.replay({ fold, rpc, fromBlock: 10, toBlock: 11 });
    const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
    await native.replay({ fold: restored, rpc, fromBlock: 12, toBlock: 13 });
    const uninterrupted = new WorldFold(decoder.registry);
    await native.replay({ fold: uninterrupted, rpc, fromBlock: 10, toBlock: 13 });
    expect(restored.snapshot(1, 13)).toEqual(uninterrupted.snapshot(1, 13));
    expect(restored.modelRows("ExplorerTroops").length).toBeGreaterThan(0);
    const handler = (world: WorldFold) =>
      createHeraldRequestHandler({
        readModels: createNativeWorldIngestion(native).readModels,
        chain: "madara",
        manifest: shardManifest,
        schemas: { [schema.identity]: schema },
        worldAddress: decoder.registry.worldAddress,
        confirmedBlock: () => 13,
        chainTimestamp: () => 2160,
        decodedModelCount: decoder.registry.bySelector.size,
        fold: {
          modelRows: (name) => world.modelRows(name),
          structurePosition: (game, entity) => world.structurePosition(game, entity),
          directoryRevision: () => world.directoryRevision(),
          snapshot: (game, block, models) => world.snapshot(game, block, models),
        },
        metrics,
        undecodableEventCount: () => 0,
      });
    for (const path of ["/games", "/games/1/leaderboard"]) {
      const rebuilt = await handler(restored)(new Request(`http://localhost${path}`));
      const live = await handler(uninterrupted)(new Request(`http://localhost${path}`));
      expect(rebuilt.status, await rebuilt.clone().text()).toBe(200);
      const body = await rebuilt.json();
      expect(body).toEqual(await live.json());
      expect(path.endsWith("leaderboard") ? body.entries.length : body.games.length).toBeGreaterThan(0);
    }
    expect(restored.modelRows("PlayerPoints").length).toBeGreaterThan(0);
    expect(restored.modelRows("GameRegistry")).toHaveLength(1);
  });
  it("does not keep partial replay state if a later block fetch fails", async () => {
    const { native, fold } = setup();
    const before = fold.checkpoint();
    const rpc = {
      getBlockWithReceipts: vi.fn(async (number: number) => {
        if (number === 11) throw new Error("disconnected");
        return block(10, [setFixture.raw]);
      }),
    };
    await expect(native.replay({ fold, rpc, fromBlock: 10, toBlock: 11 })).rejects.toThrow("disconnected");
    expect(fold.checkpoint()).toEqual(before);
  });
  it("publishes both domains in one diff only after the full receipt arrives, sampling its latency once", () => {
    const { native, decoder, fold } = setup();
    const messages: Record<string, unknown>[] = [];
    const diffLatency = new DiffLatencyMonitor();
    const sampled = vi.spyOn(diffLatency, "record");
    const live = new LiveWorld({
      native,
      registry: decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: vi.fn() },
      confirmedBlock: 9,
      confirmedFold: fold,
      diffLatency,
      rpc: {} as MadaraRpc,
    });
    const connection = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) });
    live.resume(connection, { epoch: "previous", seq: 0, type: "resume" });
    messages.length = 0;
    const map = rowEvent("TileOpt", ["1", "0", "12", "34"], { data: 0n });
    live.detach(connection);
    const reconnect = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) });
    live.resume(reconnect, { epoch: "previous", seq: 0, type: "resume" });
    messages.length = 0;
    expect(live.snapshot("1").models.find((model) => model.model === "ExplorerTroops")?.rows).toEqual([]);
    live.acceptReceipt({ ...receipt([setFixture.raw, map], "0x77"), finality_status: "PRE_CONFIRMED" });
    const diffs = messages.filter((message) => message.type === "diff");
    expect(diffs).toHaveLength(1);
    expect((diffs[0].set as { model: string }[]).map((row) => row.model).sort()).toEqual(["ExplorerTroops", "TileOpt"]);
    live.acceptReceipt({ ...receipt([setFixture.raw, map], "0x77"), finality_status: "PRE_CONFIRMED" });
    expect(messages.filter((message) => message.type === "diff")).toHaveLength(1);
    expect(sampled.mock.calls).toEqual([["preconfirmed", expect.any(Number)]]);
  });
  it.each([
    malformed.raw,
    { ...setFixture.raw, keys: [...setFixture.raw.keys.slice(0, 2), "2", ...setFixture.raw.keys.slice(3)] },
  ])("rejects invalid rows without partial publication and accepts the next valid receipt", (invalid) => {
    const { native, decoder, fold } = setup();
    const messages: string[] = [];
    const live = new LiveWorld({
      native,
      registry: decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: vi.fn() },
      confirmedBlock: 9,
      confirmedFold: fold,
      rpc: {} as MadaraRpc,
    });
    const connection = live.attach("1", { send: (text) => messages.push(text) });
    live.resume(connection, { epoch: "old", seq: 0, type: "resume" });
    messages.length = 0;
    expect(() =>
      live.acceptReceipt({ ...receipt([setFixture.raw, invalid]), finality_status: "PRE_CONFIRMED" }),
    ).not.toThrow();
    expect(messages).toEqual([]);
    expect(native.receiptFailures).toBe(1);
    live.acceptReceipt({ ...receipt([setFixture.raw], "0x888"), finality_status: "PRE_CONFIRMED" });
    expect(messages).toHaveLength(1);
  });
});

it("confirms a receipt from its pre-confirmed decode at the confirmed position, and decodes afresh when its events differ", async () => {
  const { native, decoder, fold } = setup();
  const [genesis] = wireHistory();
  await native.replay({ fold, rpc: { getBlockWithReceipts: async () => genesis! }, fromBlock: 10, toBlock: 10 });
  const pending = receipt([setFixture.raw, pointsAward("1", "0x111", "200", "200", "200")], "0xb1");
  const earlier = { events: pending.events, decoded: native.applyReceipt(fold.overlay(), pending, null, 0).events };
  const confirmed: RpcBlockWithReceipts = {
    block_number: 11,
    timestamp: 2161,
    transactions: [
      { receipt: receipt([pointsAward("1", "0x222", "5", "5", "5")], "0xa1"), transaction: { type: "INVOKE" } },
      { receipt: pending, transaction: { type: "INVOKE" } },
    ],
  };
  const confirm = (preconfirmed?: () => typeof earlier) => {
    const copy = WorldFold.restore(decoder.registry, fold.checkpoint());
    const rpc = { getBlockWithReceipts: async () => confirmed };
    return native
      .replay({ fold: copy, rpc, fromBlock: 11, toBlock: 11, preconfirmed })
      .then((result) => ({ copy, result }));
  };
  const fresh = await confirm();
  const decode = vi.spyOn(decoder, "decode");

  const reused = await confirm(() => earlier);
  expect(decode).toHaveBeenCalledTimes(1);
  expect(reused.result.events).toEqual(fresh.result.events);
  expect(reused.result.events.at(-1)!.position).toMatchObject({ blockNumber: 11, transactionIndex: 1, eventIndex: 1 });
  expect(reused.copy.checkpoint()).toEqual(fresh.copy.checkpoint());

  decode.mockClear();
  const differing = await confirm(() => ({ ...earlier, events: [setFixture.raw] }));
  expect(decode).toHaveBeenCalledTimes(3);
  expect(differing.result.events).toEqual(fresh.result.events);
});

it("rebuilds state and history from genesis in one replay when history lags the checkpoint", async () => {
  const { native, decoder } = setup();
  const blocks = wireHistory();
  const rpc = {
    blockNumber: vi.fn(async () => 13),
    getBlockWithReceipts: vi.fn(async (number: number) => blocks[number - 10]),
  } as unknown as MadaraRpc;
  const stale = new WorldFold(decoder.registry);
  const checkpointStore = {
    initialize: vi.fn(),
    load: vi.fn(async () => ({ fold: stale, confirmedBlock: 12 })),
    save: vi.fn(),
  };
  const history = { appendEvents: vi.fn(), historyProgress: vi.fn(async () => 11) };
  const loaded = await loadNativeWorld({ chain: "madara", checkpointStore, history, native, rpc });
  expect(rpc.getBlockWithReceipts).toHaveBeenCalledTimes(4);
  expect(loaded.fold).not.toBe(stale);
  expect(history.appendEvents).toHaveBeenCalledOnce();
  expect(history.appendEvents.mock.calls[0]![1]).toBe(13);
  expect(checkpointStore.save).toHaveBeenCalledWith("madara", 13, loaded.fold);
});

it("reports a member write to a row it does not hold once, skips it, and keeps folding", async () => {
  const { native, decoder, fold } = setup();
  const model = schema.models.find(({ name }) => name === "TileOpt")!;
  const layout = schema.games.events.find(({ name }) => name === "RowMemberSet")!;
  const unheldTile = {
    from_address: decoder.manifest.world.address,
    keys: [...layout.prefix, "1", model.identity, model.members[0]!.id!],
    data: ["4", "1", "0", "5", "5", "1", "2"],
  };
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const diffLatency = { record: vi.fn() } as unknown as DiffLatencyMonitor;
  const live = new LiveWorld({
    native,
    chain: "madara",
    registry: decoder.registry,
    confirmedBlock: 9,
    confirmedFold: fold,
    checkpointStore: { save: vi.fn(async () => {}) },
    checkpointEveryBlocks: 1,
    diffLatency,
    rpc: {
      getBlockWithReceipts: vi.fn(async () => block(10, [unheldTile, setFixture.raw])),
    } as unknown as MadaraRpc,
  });

  await live.acceptSubscribedHead({ block_number: 10, timestamp: 2160 });

  const violations = error.mock.calls
    .map(([line]) => JSON.parse(String(line)))
    .filter(({ event }) => event === "herald_invariant_violation");
  expect(violations).toEqual([
    expect.objectContaining({
      block: 10,
      eventIndex: 0,
      kind: "update-member",
      model: "TileOpt",
      transactionHash: "0xa",
    }),
  ]);
  expect(fold.modelRows("TileOpt")).toEqual([]);
  expect(fold.modelRows("ExplorerTroops").length).toBeGreaterThan(0);
  expect(native.halted).toBeUndefined();
  expect(live.confirmedBlock).toBe(10);
  expect(diffLatency.record).toHaveBeenCalledWith("confirmed", expect.any(Number), 1);
  error.mockRestore();
});

it("halts a confirmed rejection at the last checkpoint without killing receipt subscriptions or startup", async () => {
  const { native, decoder, fold } = setup();
  const before = fold.checkpoint();
  const rpc = {
    blockNumber: vi.fn(async () => 10),
    getBlockWithReceipts: vi.fn(async () => block(10, [setFixture.raw, malformed.raw])),
  } as unknown as MadaraRpc;
  const checkpointStore = {
    initialize: vi.fn(),
    load: vi.fn(async () => ({ fold, confirmedBlock: 9 })),
    save: vi.fn(),
  };
  const history = { appendEvents: vi.fn(), historyProgress: vi.fn(async () => 9) };
  const loaded = await loadNativeWorld({ chain: "madara", checkpointStore, history, native, rpc });
  expect(loaded.confirmedBlock).toBe(9);
  expect(loaded.fold.checkpoint()).toEqual(before);
  expect(native.halted).toMatchObject({ block: 10 });
  expect(native.receiptFailures).toBe(1);
  const live = new LiveWorld({
    native,
    chain: "madara",
    registry: decoder.registry,
    confirmedBlock: 9,
    confirmedFold: fold,
    checkpointStore,
    checkpointEveryBlocks: 1,
    rpc,
  });
  await expect(live.acceptSubscribedHead({ block_number: 11, timestamp: 3000 })).resolves.toBeUndefined();
  live.acceptReceipt({ ...receipt([setFixture.raw]), finality_status: "PRE_CONFIRMED" });
  expect(live.confirmedBlock).toBe(9);
  expect(checkpointStore.save).not.toHaveBeenCalled();
  expect(rpc.getBlockWithReceipts).toHaveBeenCalledTimes(1);
});

it("halts a live confirmed fold atomically while leaving the process available", async () => {
  const { native, decoder, fold } = setup();
  const before = fold.checkpoint();
  const rpc = {
    getBlockWithReceipts: vi.fn(async () => block(10, [setFixture.raw, malformed.raw])),
  } as unknown as MadaraRpc;
  const live = new LiveWorld({
    native,
    chain: "madara",
    registry: decoder.registry,
    confirmedBlock: 9,
    confirmedFold: fold,
    checkpointStore: { save: vi.fn() },
    checkpointEveryBlocks: 1,
    rpc,
  });
  await expect(live.acceptSubscribedHead({ block_number: 10, timestamp: 2160 })).resolves.toBeUndefined();
  expect(native.halted).toMatchObject({ block: 10 });
  expect(live.confirmedBlock).toBe(9);
  expect(fold.checkpoint()).toEqual(before);
  const handler = createHeraldRequestHandler({
    chain: "madara",
    manifest: shardManifest,
    schemas: { [schema.identity]: schema },
    worldAddress: decoder.registry.worldAddress,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
    decodedModelCount: decoder.registry.bySelector.size,
    fold: {
      modelRows: (model) => fold.modelRows(model),
      structurePosition: (game, entity) => fold.structurePosition(game, entity),
      directoryRevision: () => fold.directoryRevision(),
      snapshot: (game, block, models) => fold.snapshot(game, block, models),
    },
    metrics,
    undecodableEventCount: () => native.receiptFailures,
    ingestionFailure: () =>
      native.halted
        ? { block: native.halted.block, transactionHash: native.halted.transactionHash, error: native.halted.message }
        : undefined,
  });
  const response = await handler(new Request("http://localhost/health"));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ success: false, confirmed_block: 9, undecodable_events: 1 });
});

it("preserves the two story identities from overlay through confirmation despite intervening facts", async () => {
  const { native, fold, decoder } = setup();
  const scope = { chainId: "madara", worldAddress: decoder.registry.worldAddress, gameId: 1 };
  const layout = schema.games.events.find((event) => event.name === "StoryEvent")!;
  const story = (index: number): RpcEvent => ({
    from_address: decoder.registry.worldAddress,
    keys: [...layout.prefix, "1", "1", "42", String(index), "0", "0x111", "0", "3", "0x55"],
    data: ["1", String(index + 1), "2160"],
  });
  const points = pointsAward("1", "0x111", "100", "100", "100");
  const pending = receipt([story(0), points, story(1)]);
  const overlay = native.applyReceipt(fold.overlay(), pending, null, 0);
  const confirmed = block(10, [points, story(0), story(1)]);
  confirmed.transactions[0]!.receipt.transaction_hash = pending.transaction_hash;
  const replay = await native.replay({
    fold,
    rpc: { getBlockWithReceipts: async () => confirmed },
    fromBlock: 10,
    toBlock: 10,
    preconfirmed: () => ({ events: pending.events, decoded: overlay.events }),
  });
  const stories = (events: typeof overlay.events) =>
    events.filter((event) => event.kind === "event" && event.model.name === "StoryEvent");
  const before = stories(overlay.events);
  const after = stories(replay.events);
  expect(before.map((event) => event.key.index)).toEqual([0n, 1n]);
  expect(new Set(before.map((event) => event.entityId)).size).toBe(2);
  expect(after.map((event) => event.entityId)).toEqual(before.map((event) => event.entityId));
  expect(before.map((event) => event.position.eventIndex)).toEqual([0, 2]);
  expect(after.map((event) => event.position.eventIndex)).toEqual([1, 2]);
  const identities = (events: typeof before) =>
    events.map((event) => storyEventIdentity(scope, toJsonValue(event.key) as Record<string, unknown>));
  expect(identities(after)).toEqual(identities(before));
  expect(fold.modelRows("PlayerPoints")).toHaveLength(1);
});

it("retains only one 64-block cold-replay window and no receipts, checkpointing before fetching the next", async () => {
  const { native } = setup();
  let saved = -1;
  let historyThrough = -1;
  const retained: { events: number; changes: number; receipts: number; rows: number }[] = [];
  const replay = native.replay.bind(native);
  // Count the actual returned objects without retaining the windows in a mock's call/result history.
  native.replay = async (input) => {
    expect(input.toBlock - input.fromBlock + 1).toBeLessThanOrEqual(64);
    expect(saved).toBe(input.fromBlock - 1);
    const result = await replay(input);
    retained.push({
      events: result.events.length,
      changes: [...result.changes.values()].reduce((n, rows) => n + rows.length, 0),
      receipts: result.transactions.length,
      rows: input.fold.retainedRowCount(),
    });
    return result;
  };
  const outcomes = vi.spyOn(native, "executionReceipt");
  const rpc = {
    blockNumber: async () => 383,
    getBlockWithReceipts: async (number: number) => {
      expect(number - saved).toBeLessThanOrEqual(64);
      return block(number, [setFixture.raw, battleEvent("7", "8", "1920", String(number))]);
    },
  } as unknown as MadaraRpc;
  const checkpointStore = {
    initialize: async () => {},
    load: async () => undefined,
    save: async (_chain: string, head: number, fold: WorldFold) => {
      expect(historyThrough).toBe(head);
      expect(fold.retainedRowCount()).toBe(1);
      saved = head;
    },
  };
  const history = {
    historyProgress: async () => null,
    appendEvents: async (events: readonly unknown[], head?: number) => {
      expect(events.length).toBeLessThanOrEqual(64);
      expect(head).toBeDefined();
      historyThrough = head!;
    },
  };
  const loaded = await loadNativeWorld({ chain: "madara", native, rpc, checkpointStore, history });
  expect(retained).toHaveLength(6);
  expect(retained.slice(1)).toEqual(
    Array.from({ length: 5 }, () => ({ events: 128, changes: 128, receipts: 0, rows: 1 })),
  );
  expect(outcomes).not.toHaveBeenCalled();
  expect(loaded.confirmedBlock).toBe(383);
  expect(loaded.checkpointBlock).toBe(383);
  expect(loaded.metrics.pages).toBe(374);
  expect(loaded.metrics.decoded_events).toBe(748);
  expect(loaded.fold.retainedRowCount()).toBe(1);
});

it("keeps a completed startup window when the next window rejects a receipt and resumes from it", async () => {
  const { native, decoder } = setup();
  let saved: ReturnType<WorldFold["checkpoint"]> | undefined;
  let historyThrough = -1;
  let broken = true;
  const rpc = {
    blockNumber: async () => 130,
    getBlockWithReceipts: async (number: number) =>
      block(number, [broken && number === 70 ? malformed.raw : setFixture.raw]),
  } as unknown as MadaraRpc;
  const checkpointStore = {
    initialize: async () => {},
    load: async () => (saved ? { confirmedBlock: 63, fold: WorldFold.restore(decoder.registry, saved) } : undefined),
    save: async (_chain: string, head: number, fold: WorldFold) => {
      expect(historyThrough).toBe(head);
      saved = fold.checkpoint();
    },
  };
  const history = {
    historyProgress: async () => historyThrough,
    appendEvents: async (_events: readonly unknown[], head?: number) => {
      expect(head).toBeDefined();
      historyThrough = head!;
    },
  };
  const failed = await loadNativeWorld({ chain: "madara", native, rpc, checkpointStore, history });
  expect(failed.confirmedBlock).toBe(63);
  expect(failed.checkpointBlock).toBe(63);
  expect(failed.fold.checkpoint()).toEqual(saved);
  expect(native.halted?.block).toBe(70);
  broken = false;
  const restarted = setup().native;
  const loaded = await loadNativeWorld({ chain: "madara", native: restarted, rpc, checkpointStore, history });
  expect(loaded.confirmedBlock).toBe(130);
  expect(loaded.metrics.pages).toBe(67);
});
