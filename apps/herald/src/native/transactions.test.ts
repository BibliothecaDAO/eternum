import { WorldFold } from "../world-fold";
import { CallData, hash, shortString, type RawArgs } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { LiveWorld } from "../live-world";
import type { MadaraRpc } from "../madara-rpc";
import type { RpcBlockWithReceipts } from "../types";
import { manifest, receipt, schema, setup } from "./fixtures";
import { transactionScopes } from "./transactions";

function executionEvent(status: number, nonceConsumed = true, nonce = 0, order = 1) {
  const layout = schema.domains.season.events.find((event) => event.name === "ExecutionRecorded")!;
  return {
    from_address: manifest.world.address,
    keys: layout.prefix,
    data: [
      "1",
      "0x111",
      String(nonce),
      nonceConsumed ? "1" : "0",
      String(order),
      String(status),
      status === 2 ? shortString.encodeShortString("GAMEPLAY_REJECTED") : "0",
    ],
  };
}

function action(game: number) {
  return {
    intent: {
      chain: 1,
      deployment: manifest.world.address,
      game_id: game,
      actor: "0x111",
      nonce: 0,
      valid_from: 2000,
      valid_until: 3000,
      last_order: 1,
      rules: 1,
      command: 1,
      arguments: [2, 1],
    },
    context: { envelope: [] },
    signature: [1, 2],
  };
}

function encodedCall(entrypoint: string, args: RawArgs) {
  const abi = [...Object.values(schema.types), ...schema.domains.season.entrypoints];
  const calldata = new CallData(abi).compile(entrypoint, args);
  return [manifest.world.address, hash.getSelectorFromName(entrypoint), String(calldata.length), ...calldata];
}

function call(game: number, entrypoint = "execute") {
  return encodedCall(entrypoint, action(game));
}

function batchCall(games: number[]) {
  return encodedCall("execute_batch", { actions: games.map(action) });
}

describe("native transaction receipt routing", () => {
  it.each(["both", "receipt", "transaction"])(
    "recovers batched outcomes from confirmed history when %s notifications are lost",
    async (missing) => {
      const { native, decoder, fold } = setup();
      const rejected = executionEvent(2, false, 0, 2);
      rejected.data[0] = "2";
      const accepted = receipt([executionEvent(1), rejected], "0xabc");
      const transaction = {
        type: "INVOKE",
        sender_address: "0x999",
        calldata: ["1", ...batchCall([1, 2])],
      };
      const block: RpcBlockWithReceipts = {
        block_number: 10,
        timestamp: 100,
        transactions: [{ receipt: accepted, transaction }],
      };
      const live = new LiveWorld({
        native,
        registry: decoder.registry,
        chain: "madara",
        checkpointEveryBlocks: 100,
        checkpointStore: { save: vi.fn() },
        confirmedBlock: 9,
        confirmedFold: fold,
        rpc: {
          getBlockWithReceipts: async (number: unknown) =>
            number === "pre_confirmed" ? { ...block, block_number: 11, transactions: [] } : block,
        } as unknown as MadaraRpc,
      });
      const streams = ["1", "2"].map((gameId) => {
        const messages: Record<string, unknown>[] = [];
        const connection = live.attach(gameId, { send: (value) => messages.push(JSON.parse(value)) }, "0x111");
        live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
        messages.length = 0;
        return messages;
      });
      if (missing === "receipt")
        live.acceptTransaction({ ...transaction, transaction_hash: "0xabc", finality_status: "PRE_CONFIRMED" });
      if (missing === "transaction") live.acceptReceipt(accepted);
      expect(streams.flat().filter((message) => message.type === "tx")).toEqual([]);

      await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
      for (const [index, messages] of streams.entries()) {
        const outcomes = messages.filter((message) => message.type === "tx");
        expect(outcomes.at(-1)).toMatchObject({
          hash: "0xabc",
          block: 10,
          status: "ACCEPTED_ON_L2",
          executions: [
            expect.objectContaining({
              gameId: String(index + 1),
              status: index === 0 ? "SUCCEEDED" : "REVERTED",
              nonceConsumed: index === 0,
            }),
          ],
        });
        expect((outcomes.at(-1)!.executions as unknown[]).length).toBe(1);
      }
      expect(streams[0].findIndex((message) => message.type === "diff")).toBeLessThan(
        streams[0].findIndex((message) => message.type === "tx"),
      );
      const nonce = fold.modelRows("ActionNonce");
      expect(nonce).toHaveLength(1);
      expect(BigInt(String(nonce[0].value.next_nonce))).toBe(1n);
      const count = streams[0].length;
      await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
      expect(streams[0]).toHaveLength(count);
    },
  );

  it("routes every game in one compiled execution batch and rejects malformed batches", () => {
    const batch = batchCall([1, 2, 1, 3]);
    expect(transactionScopes(manifest, ["1", ...batch])).toEqual(
      ["1", "2", "3"].map((gameId) => ({ gameId, actor: "273" })),
    );
    const truncated = batch.slice(0, -1);
    truncated[2] = String(Number(truncated[2]) - 1);
    expect(() => transactionScopes(manifest, ["1", ...truncated])).toThrow();
  });
  it("recovers an enclosing transaction revert without execution events", async () => {
    const { native, decoder, fold } = setup();
    const reverted = {
      ...receipt([], "0xdead"),
      execution_status: "REVERTED",
      revert_reason: "execution exhausted",
    };
    const block: RpcBlockWithReceipts = {
      block_number: 10,
      timestamp: 100,
      transactions: [{ receipt: reverted, transaction: { type: "INVOKE", calldata: ["1", ...call(1)] } }],
    };
    const live = new LiveWorld({
      native,
      registry: decoder.registry,
      chain: "madara",
      checkpointEveryBlocks: 100,
      checkpointStore: { save: vi.fn() },
      confirmedBlock: 9,
      confirmedFold: fold,
      rpc: {
        getBlockWithReceipts: async (number: unknown) =>
          number === "pre_confirmed" ? { ...block, block_number: 11, transactions: [] } : block,
      } as unknown as MadaraRpc,
    });
    const messages: Record<string, unknown>[] = [];
    const connection = live.attach("1", { send: (value) => messages.push(JSON.parse(value)) }, "0x111");
    live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
    await live.acceptSubscribedHead({ block_number: 10, timestamp: 100 });
    expect(messages.filter((message) => message.type === "tx")).toEqual([
      expect.objectContaining({ hash: "0xdead", block: 10, status: "REVERTED", revert_reason: "execution exhausted" }),
    ]);
    expect(fold.modelRows("ActionNonce")).toEqual([]);
  });
  it("uses the authenticated intent's game for every action call", () => {
    const calldata = ["3", ...call(1), ...call(2, "execute"), ...call(1)];
    expect(transactionScopes(manifest, calldata)).toEqual(["1", "2"].map((gameId) => ({ gameId, actor: "273" })));
    expect(() => transactionScopes(manifest, ["1", ...call(1).slice(0, -1)])).toThrow();
    expect(() => transactionScopes(manifest, ["1", ...call(1), "0"])).toThrow();
    expect(() => transactionScopes(manifest, ["invalid"])).toThrow();
    const foreign = call(1);
    foreign[0] = "0x999";
    expect(transactionScopes(manifest, ["1", ...foreign])).toEqual([]);
  });
  it("decodes a compiled batch result and publishes it with the matching transaction", () => {
    const { native, decoder, fold } = setup();
    const layout = schema.domains.season.events.find((event) => event.name === "BatchProgress")!;
    const progress = { from_address: manifest.world.address, keys: [...layout.prefix, "1"], data: ["0x111", "0", "9"] };
    const decoded = decoder.decode({
      ...progress,
      block_number: 10,
      transaction_hash: "0x123",
      transaction_index: 0,
      event_index: 0,
    });
    expect(decoded.kind).toBe("event");
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
    const connection = live.attach("1", { send: (value) => messages.push(JSON.parse(value)) }, "0x111");
    live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
    live.acceptTransaction({
      finality_status: "PRE_CONFIRMED",
      transaction_hash: "0x123",
      sender_address: "0x999",
      calldata: ["1", ...call(1)],
    });
    live.acceptReceipt(receipt([progress, executionEvent(1)], "0x123"));
    expect(messages.filter((message) => message.type === "tx").at(-1)).toMatchObject({
      hash: "0x123",
      executions: [expect.objectContaining({ order: "1", status: "SUCCEEDED", batchRemaining: "9" })],
    });
  });
  it.each(["PRE_CONFIRMED", "ACCEPTED_ON_L2"])(
    "reports a recorded rejection at %s without reverting ticket state",
    (finality_status) => {
      const { native, decoder, fold } = setup();
      const messages: Record<string, unknown>[] = [];
      const historyStore = { recordTransaction: vi.fn() };
      const live = new LiveWorld({
        native,
        registry: decoder.registry,
        chain: "madara",
        checkpointEveryBlocks: 100,
        checkpointStore: { save: vi.fn() },
        confirmedBlock: 9,
        confirmedFold: fold,
        rpc: {} as MadaraRpc,
        historyStore: historyStore as never,
      });
      const connection = live.attach("1", { send: (value) => messages.push(JSON.parse(value)) }, "0x111");
      live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
      messages.length = 0;
      const result = executionEvent(2);
      const rejected = { ...receipt([result], "0x124"), finality_status };
      live.acceptReceipt(rejected);
      live.acceptTransaction({
        finality_status: "PRE_CONFIRMED",
        transaction_hash: "0x124",
        sender_address: "0x999",
        calldata: ["1", ...call(1)],
      });
      const transactions = messages.filter((message) => message.type === "tx");
      expect(transactions.at(-1)).toMatchObject({
        status: finality_status,
        executions: [expect.objectContaining({ status: "REVERTED" })],
      });
      expect(JSON.stringify(transactions)).toContain("GAMEPLAY_REJECTED");
      expect(rejected.execution_status).toBe("SUCCEEDED");
      native.applyReceipt(fold, rejected, 10, 0);
      expect(BigInt(String(fold.modelRows("ActionNonce")[0].value.next_nonce))).toBe(1n);
      expect(native.receiptFailures).toBe(0);
      expect(native.halted).toBeUndefined();
      if (finality_status === "ACCEPTED_ON_L2") {
        expect(historyStore.recordTransaction).toHaveBeenCalledWith(
          "1",
          expect.objectContaining({
            execution_status: "SUCCEEDED",
            executions: [expect.objectContaining({ status: "REVERTED", reason: "GAMEPLAY_REJECTED" })],
          }),
        );
      } else expect(historyStore.recordTransaction).not.toHaveBeenCalled();
    },
  );

  it("preserves a successful recorded action's finality", () => {
    const { native, fold } = setup();
    const succeeded = receipt([executionEvent(1)]);
    expect(native.actionReceipt(fold, succeeded)).toMatchObject({
      ...succeeded,
      executions: [expect.objectContaining({ order: "1", status: "SUCCEEDED" })],
    });
  });

  it.each(["PRE_CONFIRMED", "ACCEPTED_ON_L2"])(
    "delivers mixed ticket outcomes only to their game and actor at %s",
    (finality_status) => {
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
      const connection = live.attach("1", { send: (value) => messages.push(JSON.parse(value)) }, "0x111");
      live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
      const otherMessages: Record<string, unknown>[] = [];
      for (const [gameId, actor] of [
        ["1", "0x222"],
        ["3", "0x111"],
      ]) {
        const other = live.attach(gameId, { send: (value) => otherMessages.push(JSON.parse(value)) }, actor);
        live.resume(other, { type: "resume", epoch: "", seq: 0 });
      }
      otherMessages.length = 0;
      const rejected = executionEvent(2, false, 0, 2);
      const otherGame = executionEvent(1, true, 0, 3);
      otherGame.data[0] = "2";
      live.acceptTransaction({
        finality_status: "PRE_CONFIRMED",
        transaction_hash: "0xabc",
        sender_address: "0x999",
        calldata: ["1", ...batchCall([1, 1, 2])],
      });
      live.acceptReceipt({ ...receipt([executionEvent(1), rejected, otherGame], "0xabc"), finality_status });
      expect(otherMessages).toEqual([]);
      const transaction = messages.filter((message) => message.type === "tx").at(-1);
      expect(transaction).toMatchObject({
        status: finality_status,
        executions: [
          expect.objectContaining({ gameId: "1", order: "1", status: "SUCCEEDED", nonceConsumed: true }),
          expect.objectContaining({ gameId: "1", order: "2", status: "REVERTED", nonceConsumed: false }),
        ],
      });
      expect(native.receiptFailures).toBe(0);
    },
  );

  it("supplies an explicit initial nonce from complete history without replacing an executed nonce", () => {
    const { native, fold } = setup();
    const nonceRows = (actor: string) =>
      fold.snapshot(1, 10, undefined, actor).models.find(({ model }) => model === "ActionNonce")!.rows;
    expect(nonceRows("0x111")).toHaveLength(1);
    expect(nonceRows("0x111")[0].value.next_nonce).toBe("0");
    expect(fold.modelRows("ActionNonce")).toHaveLength(0);
    native.applyReceipt(fold, receipt([executionEvent(1)]), 10, 0);
    expect(nonceRows("0x111")).toHaveLength(1);
    expect(BigInt(String(nonceRows("0x111")[0].value.next_nonce))).toBe(1n);
    expect(nonceRows("0x222")).toHaveLength(2);
    expect(() => nonceRows("0x0")).toThrow("Invalid gameplay account");
    expect(() => nonceRows("0x800000000000000000000000000000000000000000000000000000000000000")).toThrow(
      "Invalid gameplay account",
    );
  });

  it("leaves the nonce row unchanged for a stale-nonce rejection and restores it from a checkpoint", () => {
    const { native, decoder, fold } = setup();
    native.applyReceipt(fold, receipt([executionEvent(1)]), 10, 0);
    const before = fold.modelRows("ActionNonce");
    native.applyReceipt(fold, receipt([executionEvent(2, false, 0, 2)], "0x999"), 11, 0);
    expect(fold.modelRows("ActionNonce")).toEqual(before);
    const restored = WorldFold.restore(decoder.registry, fold.checkpoint());
    expect(restored.modelRows("ActionNonce")).toEqual(before);
    native.applyReceipt(restored, receipt([executionEvent(1, true, 1, 3)], "0x998"), 12, 0);
    expect(BigInt(String(restored.modelRows("ActionNonce")[0].value.next_nonce))).toBe(2n);
  });

  it("delivers a reverted receipt received before its sequencer-submitted transaction", () => {
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
    const connection = live.attach("1", { send: (value) => messages.push(JSON.parse(value)) }, "0x111");
    live.resume(connection, { type: "resume", epoch: "old", seq: 0 });
    messages.length = 0;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      live.acceptTransaction({ finality_status: "PRE_CONFIRMED", transaction_hash: "0xbad", calldata: ["invalid"] }),
    ).not.toThrow();
    expect(native.routingFailures).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("herald_native_transaction_routing_failed"));
    expect(JSON.parse(log.mock.calls.at(-1)![0])).toMatchObject({
      event: "herald_native_transaction_routing_failed",
      transactionHash: "0xbad",
    });
    log.mockRestore();
    live.acceptReceipt({ ...receipt([], "0x123"), execution_status: "REVERTED", revert_reason: "invalid command" });
    expect(messages).toEqual([]);
    live.acceptTransaction({
      finality_status: "PRE_CONFIRMED",
      transaction_hash: "0x123",
      sender_address: "0x999",
      calldata: ["1", ...call(1)],
    });
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages[0])).toContain("REVERTED");
    expect(fold.retainedRowCount()).toBe(0);
  });
});
