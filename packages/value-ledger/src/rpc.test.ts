import { afterEach, expect, it, vi } from "vitest";
import { rpcBatch, SHARD_RPC_MAX_BATCH_CALLS } from "./rpc";

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
