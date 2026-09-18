import { createNativeWorldIngestion } from "./world-ingestion";
import { loadNativeWorld } from "./load";
import { describe, expect, it, vi } from "vitest";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import deleted from "../../../../contracts/l3/world-native/schema/fixtures/row-deleted.json";
import malformed from "../../../../contracts/l3/world-native/schema/fixtures/malformed-row.json";
import { LiveWorld } from "../live-world";
import { WorldFold } from "../world-fold";
import { createHeraldRequestHandler } from "../http";
import type { MadaraRpc } from "../madara-rpc";
import type { RpcEvent, RpcBlockWithReceipts } from "../types";
import { manifest, receipt, setup, rowEvent, rulesEvent } from "./fixtures";

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
    ["0x706172697479", "0", "0", "1", "0x111", "0", "1", "0", "1800", "1800", "999999", "0", "0", "1"],
  );
  return [
    block(10, [game, rulesEvent(), rowEvent("SettlementRules", ["1"], ["1800", "96", "0", "1"]), ...events]),
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
    for (const path of ["/madara/games", "/madara/games/1/leaderboard"]) {
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
  it("publishes both domains in one diff only after the full receipt arrives", () => {
    const { native, decoder, fold } = setup();
    const messages: Record<string, unknown>[] = [];
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
  });
  it.each([
    malformed.raw,
    { ...setFixture.raw, from_address: manifest.native.domains.map.address },
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
  const loaded = await loadNativeWorld({ chain: "madara", checkpointStore, native, rpc });
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
    worldAddress: decoder.registry.worldAddress,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
    decodedModelCount: decoder.registry.bySelector.size,
    fold,
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
