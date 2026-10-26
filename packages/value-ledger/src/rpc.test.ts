import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it, vi } from "vitest";
import { isDeploymentBlock, rpcAt, rpcBatch, SHARD_RPC_MAX_BATCH_CALLS, type ClassHashReader } from "./rpc";

const URL = "https://shard.test/rpc";

/** A node that answers each call of a batch with `answer(id)`, in the order given by `order`. */
const node = (answer: (id: number) => unknown, order: (ids: number[]) => number[] = (ids) => ids) => {
  const sent: unknown[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const calls = JSON.parse(String(init.body)) as { id: number; method: string; params: unknown }[];
      sent.push(calls);
      return Response.json(
        order(calls.map(({ id }) => id)).map((id) => ({ jsonrpc: "2.0", id, ...(answer(id) as object) })),
      );
    }),
  );
  return sent;
};

afterEach(() => vi.unstubAllGlobals());

it("sends one batch and returns its answers in request order, however the node orders them", async () => {
  const sent = node(
    (id) => ({ result: { block_number: 100 + id } }),
    (ids) => [...ids].reverse(),
  );
  const answers = await rpcBatch(
    URL,
    "starknet_getBlockWithTxHashes",
    [1, 2, 3].map((n) => ({ block_id: n })),
  );
  expect(answers).toEqual([{ block_number: 100 }, { block_number: 101 }, { block_number: 102 }]);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toEqual(
    [1, 2, 3].map((n, id) => ({
      jsonrpc: "2.0",
      id,
      method: "starknet_getBlockWithTxHashes",
      params: { block_id: n },
    })),
  );
});

it("fails the whole read when any call fails, so a caller never acts on part of a batch", async () => {
  node((id) => (id === 1 ? { error: { code: 24, message: "Block not found" } } : { result: {} }));
  await expect(rpcBatch(URL, "starknet_getBlockWithTxHashes", [{}, {}, {}])).rejects.toThrow("rpc_batch_call_failed");
});

it("refuses a batch larger than the shard's public RPC accepts, before sending it", async () => {
  const sent = node(() => ({ result: {} }));
  const calls = Array.from({ length: SHARD_RPC_MAX_BATCH_CALLS + 1 }, () => ({}));
  await expect(rpcBatch(URL, "starknet_getBlockWithTxHashes", calls)).rejects.toThrow("rpc_batch_too_large");
  expect(sent).toHaveLength(0);
});

/** A node on which the contract exists from block `first` on; Starknet answers code 20 before that. */
const chainFrom = (first: number, failure?: Error): ClassHashReader => ({
  getClassHashAt: vi.fn(async (_address: string, block: number) => {
    if (failure) throw failure;
    if (block < first) throw Object.assign(new Error("Contract not found"), { code: 20 });
    return "0xc1a55";
  }),
});

it("names a contract's deployment block only where it exists and did not one block before", async () => {
  expect(await isDeploymentBlock(chainFrom(100), "0x10", 100)).toBe(true);
  expect(await isDeploymentBlock(chainFrom(100), "0x10", 101)).toBe(false);
  expect(await isDeploymentBlock(chainFrom(100), "0x10", 99)).toBe(false);
  expect(await isDeploymentBlock(chainFrom(0), "0x10", 0)).toBe(false);
});

it("fails, rather than answering, when the node fails for another reason", async () => {
  await expect(isDeploymentBlock(chainFrom(100, new Error("rate limited")), "0x10", 100)).rejects.toThrow(
    "rate limited",
  );
});

/** A node on a local port that answers every transaction as accepted, and records the methods asked of it. */
const acceptingNode = async () => {
  const asked: string[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const { id, method } = JSON.parse(body) as { id: number; method: string };
      asked.push(method);
      const result =
        method === "starknet_getTransactionStatus"
          ? { finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" }
          : {
              transaction_hash: "0x1",
              type: "INVOKE",
              execution_status: "SUCCEEDED",
              finality_status: "ACCEPTED_ON_L2",
            };
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    });
  });
  await new Promise<void>((listening) => server.listen(0, "127.0.0.1", listening));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/rpc`, asked, close: () => server.close() };
};

it("learns that a sent transaction landed about two seconds after sending, not the library's ten", async () => {
  const node = await acceptingNode();
  try {
    const sent = Date.now();
    await rpcAt(node.url).waitForTransaction("0x1");
    // starknet.js waits one interval before the status and one after the receipt: 2 x 1 s here, 2 x 5 s by default.
    expect(Date.now() - sent).toBeLessThan(5_000);
    expect(node.asked).toEqual(["starknet_getTransactionStatus", "starknet_getTransactionReceipt"]);
  } finally {
    node.close();
  }
});
