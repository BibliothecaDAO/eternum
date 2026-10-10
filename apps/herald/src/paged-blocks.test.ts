import { CallData, byteArray, hash, shortString } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MadaraRpc } from "./madara-rpc";
import { setup, manifest, receipt } from "./native/fixtures";
import { blockRpcResult, syntheticBlock } from "./native/paged-block-fixtures";
import type { RpcBlockWithReceipts } from "./types";

const readers: MadaraRpc[] = [];
afterEach(() => {
  readers.forEach((rpc) => rpc.close());
  readers.length = 0;
  vi.unstubAllGlobals();
});
function node(block: RpcBlockWithReceipts, intercept?: (call: any) => unknown) {
  const calls: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const call = JSON.parse(String(init.body));
      calls.push(call);
      const result = (await intercept?.(call)) ?? blockRpcResult(block, call.method, call.params);
      return Response.json({ jsonrpc: "2.0", id: call.id, result });
    }),
  );
  const rpc = new MadaraRpc("http://node.test");
  readers.push(rpc);
  return { rpc, calls };
}

describe("paged block ingestion", () => {
  it("folds a response larger than 15 MiB through fixed emitter-filtered pages", async () => {
    const block = syntheticBlock(4100);
    expect(Buffer.byteLength(JSON.stringify(block))).toBeGreaterThan(15728640);
    const { rpc, calls } = node(block);
    const { native, fold } = setup();
    await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
    expect(fold.modelRows("PlayerPoints")).toHaveLength(4100);
    expect(BigInt(String(fold.modelRows("PointsTotal")[0].value.total))).toBe(24600n);
    const pages = calls.filter((call) => call.method === "starknet_getEvents");
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].params[0]).toMatchObject({
      address: manifest.world.address,
      from_block: { block_hash: "0xb10" },
      to_block: { block_hash: "0xb10" },
      chunk_size: 1000,
    });
    expect(pages.at(-1).params[0].continuation_token).toBe(String(Math.floor((24600 - 1) / 1000) * 1000));
    expect(calls.some((call) => call.method === "starknet_getBlockWithReceipts")).toBe(false);
    expect(calls.some((call) => call.method === "starknet_getTransactionReceipt")).toBe(false);
  }, 60000);

  it("applies nothing on a middle-page failure and retries only that page", async () => {
    const block = syntheticBlock(200),
      { native, fold } = setup();
    const before = fold.checkpoint();
    let failed = false;
    const { rpc, calls } = node(block, (call) => {
      if (call.method === "starknet_getEvents" && call.params[0].continuation_token && !failed) {
        failed = true;
        expect(fold.checkpoint()).toEqual(before);
        throw new Error("lost middle page");
      }
    });
    await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
    expect(failed).toBe(true);
    expect(
      calls.filter((call) => call.method === "starknet_getEvents" && !call.params[0].continuation_token),
    ).toHaveLength(1);
    expect(fold.modelRows("PlayerPoints")).toHaveLength(200);
    expect(BigInt(String(fold.modelRows("PointsTotal")[0].value.total))).toBe(1200n);
  });

  it("keeps receipt event positions and checkpoint commitments despite filtered foreign events", async () => {
    const block = syntheticBlock(2);
    const foreign = { from_address: "0xf00", keys: ["0x1"], data: [] };
    block.transactions[0].receipt.events.splice(1, 0, foreign);
    const expected = setup();
    const legacy = await expected.native.replay({
      fold: expected.fold,
      rpc: { readBlock: async () => block },
      fromBlock: 10,
      toBlock: 10,
    });
    const { rpc } = node(block),
      actual = setup();
    const result = await actual.native.replay({ fold: actual.fold, rpc, fromBlock: 10, toBlock: 10 });
    expect(result.events.map((event) => event.position.eventIndex)).toEqual([0, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5]);
    expect(result.events).toEqual(legacy.events);
    expect(actual.fold.checkpoint()).toEqual(expected.fold.checkpoint());
    const overlay = setup();
    const pending = await rpc.readBlock("pre_confirmed", manifest.world.address);
    pending.transactions.forEach(({ receipt, transaction }, index) =>
      overlay.native.applyReceipt(overlay.fold, receipt, null, index, transaction.calldata),
    );
    expect(overlay.fold.checkpoint()).toEqual(expected.fold.checkpoint());
  });

  it("preserves reverted play and recorded rejection outcomes using bounded status reads", async () => {
    const block = syntheticBlock(1);
    block.transactions[0].receipt = {
      ...receipt([], "0x64"),
      execution_status: "REVERTED",
      revert_reason: "before roll",
    };
    const { rpc, calls } = node(block),
      { native, fold } = setup();
    const replay = await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
    expect(replay.transactions[0].receipt).toMatchObject({
      execution_status: "REVERTED",
      revert_reason: "before roll",
    });
    expect(fold.retainedRowCount()).toBe(0);
    expect(calls.some((call) => call.method === "starknet_getTransactionStatus")).toBe(true);
  });
});

it("bounds transaction/status reads across a failed batch and its retry", async () => {
  const block = syntheticBlock(40),
    { native, fold } = setup();
  let active = 0,
    peak = 0,
    failed = false,
    headers = 0;
  const { rpc } = node(block, async (call) => {
    if (call.method === "starknet_getBlockWithTxHashes" && ++headers === 2) expect(active).toBe(0);
    if (!["starknet_getTransactionByHash", "starknet_getTransactionStatus"].includes(call.method)) return;
    active++;
    peak = Math.max(peak, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (!failed) {
        failed = true;
        throw new Error("lost transaction read");
      }
      return blockRpcResult(block, call.method, call.params);
    } finally {
      active--;
    }
  });
  await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
  expect(failed).toBe(true);
  expect(peak).toBeLessThanOrEqual(16);
  expect(active).toBe(0);
  expect(fold.modelRows("PlayerPoints")).toHaveLength(40);
});

it("reads a captured pre-confirmed prefix while later transactions append", async () => {
  const block = syntheticBlock(2);
  let headers = 0;
  const { rpc } = node(block, (call) => {
    if (call.method !== "starknet_getBlockWithTxHashes") return;
    const result = blockRpcResult(block, call.method, call.params) as { block_hash?: string; transactions: string[] };
    delete result.block_hash;
    if (++headers === 1) result.transactions = result.transactions.slice(0, 1);
    return result;
  });
  const prefix = await rpc.readBlock("pre_confirmed", manifest.world.address);
  expect(prefix.transactions).toHaveLength(1);
  expect(prefix.transactions[0].receipt.events).toHaveLength(6);
  expect(prefix.transactions[0].receipt.finality_status).toBe("PRE_CONFIRMED");
  expect((await rpc.readBlock("pre_confirmed", manifest.world.address)).transactions).toHaveLength(2);
});

it("discards a changed header and retries without applying the inconsistent block", async () => {
  const block = syntheticBlock(1),
    { native, fold } = setup();
  let headers = 0;
  const { rpc } = node(block, (call) => {
    if (call.method !== "starknet_getBlockWithTxHashes") return;
    const result = blockRpcResult(block, call.method, call.params);
    if (++headers === 2) {
      expect(fold.retainedRowCount()).toBe(0);
      return { ...result, block_hash: "0xb11" };
    }
    return result;
  });
  await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
  expect(headers).toBe(4);
  expect(fold.modelRows("PlayerPoints")).toHaveLength(1);
});

it("shutdown cancels retries without applying or skipping the unread block", async () => {
  const block = syntheticBlock(1),
    { native, fold } = setup();
  const { rpc, calls } = node(block, (call) => {
    if (call.method === "starknet_getEvents") throw new Error("node unavailable");
  });
  const stopped = expect(native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 })).rejects.toThrow();
  await vi.waitFor(() => expect(calls.some((call) => call.method === "starknet_getEvents")).toBe(true));
  rpc.close();
  await stopped;
  expect(fold.retainedRowCount()).toBe(0);
});

it("folds a recorded GameplayRejected without inventing applied game state", async () => {
  const block = syntheticBlock(1),
    { native, fold } = setup();
  block.transactions[0].receipt.events = [
    {
      from_address: manifest.world.address,
      keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x1", "0x3e8", "0x64"],
      data: [
        shortString.encodeShortString("GAMEPLAY_REJECTED"),
        ...CallData.compile(byteArray.byteArrayFromString("explorer is dead")),
      ],
    },
  ];
  const { rpc } = node(block);
  const result = await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
  expect(result.transactions[0].receipt.rejection).toEqual({
    statusClass: "GAMEPLAY_REJECTED",
    reason: "explorer is dead",
  });
  expect(fold.modelRows("PlayerPoints")).toEqual([]);
});

it("finishes a pre-confirmed prefix when its block seals during the read", async () => {
  const block = syntheticBlock(1);
  let headers = 0;
  const { rpc } = node(block, (call) => {
    if (call.method !== "starknet_getBlockWithTxHashes") return;
    const result = blockRpcResult(block, call.method, call.params) as {
      block_hash?: string;
      block_number: number;
      transactions: string[];
    };
    if (call.params[0] === "pre_confirmed") {
      delete result.block_hash;
      if (++headers === 2) return { ...result, block_number: 11, transactions: [] };
    }
    return result;
  });
  const sealed = await rpc.readBlock("pre_confirmed", manifest.world.address);
  expect(sealed.block_number).toBe(10);
  expect(sealed.transactions).toHaveLength(1);
});

it("refuses a repeated continuation token and retries before any fold", async () => {
  const block = syntheticBlock(200),
    { native, fold } = setup();
  let failed = false;
  const { rpc } = node(block, (call) => {
    if (call.method !== "starknet_getEvents" || !call.params[0].continuation_token || failed) return;
    failed = true;
    expect(fold.retainedRowCount()).toBe(0);
    return {
      ...blockRpcResult(block, call.method, call.params),
      continuation_token: call.params[0].continuation_token,
    };
  });
  await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 });
  expect(failed).toBe(true);
  expect(fold.modelRows("PlayerPoints")).toHaveLength(200);
});

it("accepts spec-shaped pre-confirmed events without a block number or hash", async () => {
  const block = syntheticBlock(1);
  const { rpc } = node(block);
  const result = await rpc.readBlock("pre_confirmed", manifest.world.address);
  expect(result.transactions[0].receipt.events).toHaveLength(6);
  expect(result.block_number).toBe(10);
});

it("retries only a failed page and stops after bounded persistent failure", async () => {
  const block = syntheticBlock(200);
  let failures = 0;
  const { rpc, calls } = node(block, (call) => {
    if (call.method === "starknet_getEvents" && call.params[0].continuation_token && failures++ === 0)
      throw new Error("temporary page failure");
  });
  await rpc.readBlock(10, manifest.world.address);
  expect(
    calls.filter((call) => call.method === "starknet_getEvents" && !call.params[0].continuation_token),
  ).toHaveLength(1);
  let requests = 0;
  const failed = node(block, (call) => {
    if (call.method === "starknet_getEvents") {
      requests++;
      throw new Error("persistent failure");
    }
  });
  await expect(failed.rpc.readBlock(10, manifest.world.address)).rejects.toThrow();
  expect(requests).toBe(3);
});

it("steady live and cold replay skip transaction and status reads for normal native events", async () => {
  const block = syntheticBlock(1300),
    { rpc, calls } = node(block);
  await rpc.readBlock(10, manifest.world.address, {
    knownTransaction: (hash: string) =>
      block.transactions.find((item) => item.receipt.transaction_hash === hash)?.transaction,
  });
  expect(
    calls.filter(
      (call) => call.method === "starknet_getTransactionByHash" || call.method === "starknet_getTransactionStatus",
    ),
  ).toHaveLength(0);
  calls.length = 0;
  const { native, fold } = setup();
  await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10, retainTransactions: false });
  expect(
    calls.filter(
      (call) => call.method === "starknet_getTransactionByHash" || call.method === "starknet_getTransactionStatus",
    ),
  ).toHaveLength(0);
});

it("halts on spec-shaped events lacking a block number in a confirmed read", async () => {
  const block = syntheticBlock(1),
    { native, fold } = setup();
  const { rpc } = node(block, (call) => {
    if (call.method !== "starknet_getEvents") return;
    const page = blockRpcResult(block, call.method, call.params) as { events: Record<string, unknown>[] };
    page.events.forEach((event) => {
      delete event.block_number;
      delete event.block_hash;
    });
    return page;
  });
  await expect(native.replay({ fold, rpc, fromBlock: 10, toBlock: 10 })).rejects.toThrow("invalid_position");
  expect(fold.retainedRowCount()).toBe(0);
});

it("logs RPC method and numeric code without node payloads on bounded failure", async () => {
  const block = syntheticBlock(1);
  const { rpc } = node(block);
  const logs: unknown[] = [];
  const warn = vi.spyOn(console, "warn").mockImplementation((value) => {
    logs.push(value);
  });
  const error = vi.spyOn(console, "error").mockImplementation((value) => {
    logs.push(value);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const call = JSON.parse(String(init.body));
      return Response.json(
        call.method === "starknet_getEvents"
          ? {
              jsonrpc: "2.0",
              id: call.id,
              error: { code: -32008, message: "untrusted-payload", data: { signature: "untrusted-payload" } },
            }
          : { jsonrpc: "2.0", id: call.id, result: blockRpcResult(block, call.method, call.params) },
      );
    }),
  );
  try {
    await expect(rpc.readBlock(10, manifest.world.address)).rejects.toThrow("starknet_getEvents (-32008)");
    const text = JSON.stringify(logs);
    expect(text).toContain("starknet_getEvents");
    expect(text).toContain("-32008");
    expect(text).not.toContain("untrusted-payload");
    expect(logs.filter((value) => JSON.parse(String(value)).event === "herald_rpc_read_failed")).toHaveLength(3);
  } finally {
    warn.mockRestore();
    error.mockRestore();
  }
});

it("cold replay still fetches the exact preset preimage calldata without a status read", async () => {
  const { presetRegistration } = await import("./native/preset-fixtures");
  const preset = presetRegistration(2),
    { native, fold } = setup();
  const block: RpcBlockWithReceipts = {
    block_number: 10,
    timestamp: 1800,
    transactions: [
      { transaction: { type: "INVOKE", calldata: preset.calldata }, receipt: receipt([preset.event], "0xabc") },
    ],
  };
  const { rpc, calls } = node(block);
  await native.replay({ fold, rpc, fromBlock: 10, toBlock: 10, retainTransactions: false });
  expect(fold.presetPreimage(preset.commitment)).toEqual(
    preset.calldata.slice(5).map((felt) => BigInt(felt).toString()),
  );
  expect(calls.filter((call) => call.method === "starknet_getTransactionByHash")).toHaveLength(1);
  expect(calls.some((call) => call.method === "starknet_getTransactionStatus")).toBe(false);
});
