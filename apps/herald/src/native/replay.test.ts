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
import { receipt, schema, setup, rowEvent, rulesEvent, shardManifest } from "./fixtures";

function block(number: number, events: RpcEvent[]): RpcBlockWithReceipts {
  return {
    block_number: number,
    timestamp: 2160,
    transactions: [{ receipt: receipt(events, `0x${number.toString(16)}`), transaction: { type: "INVOKE" } }],
  };
}
function wireHistory() {
  const events = [setFixture.raw, rowEvent("PlayerPoints", ["1", "0x111"], ["100"])];
  const game = rowEvent(
    "GameRegistry",
    ["1"],
    ["0x706172697479", "1", "0x111", "0", "1", "0", "1800", "1800", "999999", "0", "1"],
  );
  return [
    block(10, [game, rulesEvent(), rowEvent("SettlementRules", ["1"], ["1800", "96", "0", "6"]), ...events]),
    block(11, [setFixture.raw]),
    block(12, [deleted.raw]),
    block(13, [setFixture.raw]),
  ];
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
        worldAddress: decoder.registry.worldAddress,
        confirmedBlock: () => 13,
        chainTimestamp: () => 2160,
        decodedModelCount: decoder.registry.bySelector.size,
        fold: {
          modelRows: (name) => world.modelRows(name),
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
    const map = rowEvent("TileOpt", ["1", "0", "12", "34"], ["0"]);
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
  const pending = receipt([setFixture.raw, rowEvent("PlayerPoints", ["1", "0x111"], ["200"])], "0xb1");
  const earlier = { events: pending.events, decoded: native.applyReceipt(fold.overlay(), pending, null, 0).events };
  const confirmed: RpcBlockWithReceipts = {
    block_number: 11,
    timestamp: 2161,
    transactions: [
      { receipt: receipt([rowEvent("PlayerPoints", ["1", "0x222"], ["5"])], "0xa1"), transaction: { type: "INVOKE" } },
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
  const layout = schema.domains[model.owners[0]!]!.events.find(({ name }) => name === "RowMemberSet")!;
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
    worldAddress: decoder.registry.worldAddress,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
    decodedModelCount: decoder.registry.bySelector.size,
    fold: {
      modelRows: (model) => fold.modelRows(model),
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
