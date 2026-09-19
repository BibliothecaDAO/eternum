import { describe, expect, it, vi } from "vitest";
import { LiveWorld } from "./live-world";
import type { HistoryStore } from "./history-store";
import type { MadaraRpc } from "./madara-rpc";
import { receipt, rowEvent, setup } from "./native/fixtures";
import type { RpcBlockWithReceipts } from "./types";

function fixture(historyStore?: HistoryStore) {
  const { native, fold, decoder } = setup();
  const tile = (value: string) => rowEvent("TileOpt", ["1", "0", "12", "34"], [value]);
  const confirmed: RpcBlockWithReceipts = { block_number: 10, timestamp: 100, transactions: [] };
  const pending: RpcBlockWithReceipts = { block_number: 11, timestamp: 101, transactions: [] };
  const rpc = {
    blockNumber: async () => confirmed.block_number,
    getPreconfirmedHeader: async () => pending,
    getBlockWithReceipts: async (block: unknown) => (block === "pre_confirmed" ? pending : confirmed),
  } as unknown as MadaraRpc;
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "madara",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: vi.fn() },
    confirmedBlock: 9,
    confirmedFold: fold,
    rpc,
    historyStore,
  });
  const messages: Array<Record<string, unknown>> = [];
  const connection = live.attach("1", { send: (text) => messages.push(JSON.parse(text)) });
  live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
  messages.length = 0;
  const submit = (value: string, hash = "0x1") =>
    live.acceptReceipt({ ...receipt([tile(value)], hash), finality_status: "PRE_CONFIRMED" });
  const confirm = (value: string) =>
    confirmed.transactions.push({ receipt: receipt([tile(value)]), transaction: { type: "INVOKE" } });
  return { live, messages, submit, confirm, confirmed, pending, fold, native, tile };
}

describe("native live publication", () => {
  it("publishes complete receipts once and keeps confirmed snapshots separate from the overlay", () => {
    const { live, messages, submit } = fixture();
    submit("1");
    submit("1");
    expect(messages.filter((message) => message.type === "diff")).toHaveLength(1);
    expect(live.snapshot("1").models.find((model) => model.model === "TileOpt")!.rows).toEqual([]);
  });

  it("waits for the history commit before publishing the confirmed head", async () => {
    let release!: () => void;
    const appendEvents = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { live, messages, confirm } = fixture({
      appendEvents,
      freezeReviewSnapshot: vi.fn(),
    } as unknown as HistoryStore);
    confirm("1");
    const update = live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    await vi.waitFor(() => expect(appendEvents).toHaveBeenCalledOnce());
    expect(messages.filter((message) => message.type === "head")).toEqual([]);
    release();
    await update;
    expect(live.confirmedBlock).toBe(10);
    expect(messages.some((message) => message.type === "head")).toBe(true);
  });

  it("advances completeness even when the confirmed block has no story events", async () => {
    const appendEvents = vi.fn(async () => {});
    const { live } = fixture({ appendEvents, freezeReviewSnapshot: vi.fn() } as unknown as HistoryStore);
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(appendEvents).toHaveBeenCalledWith([], 10);
  });

  it("does not republish repeated heads or a clock that has not advanced", async () => {
    const { live, messages, pending } = fixture();
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    messages.length = 0;
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(messages).toEqual([]);
    await live.publishChainClock();
    await live.publishChainClock();
    expect(messages.filter((message) => message.type === "head")).toHaveLength(1);
    pending.timestamp++;
    await live.publishChainClock();
    expect(messages.filter((message) => message.type === "head")).toHaveLength(2);
  });

  it("invalidates directory readers only after confirmed changes", async () => {
    const { live, submit, confirm } = fixture();
    const changed = vi.fn();
    const unsubscribe = live.subscribeConfirmedChanges(changed);
    submit("1");
    expect(changed).not.toHaveBeenCalled();
    confirm("1");
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(changed).toHaveBeenCalledWith(new Set(["TileOpt"]));
    unsubscribe();
  });

  it("reverts a provisional row missing from the rebuilt block", async () => {
    const { live, messages, submit } = fixture();
    submit("1");
    messages.length = 0;
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    const diffs = messages.filter((message) => message.type === "diff");
    expect(diffs.some((message) => (message.del as unknown[]).length === 1)).toBe(true);
  });
});
