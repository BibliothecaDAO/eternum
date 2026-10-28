import { afterAll, expect, test } from "bun:test";
import { READ_METHODS, WRITE_METHODS, WRITES_CLOSED_MESSAGE } from "../athanor/scripts/public-rpc";
import {
  SHARD_RPC_MAX_BATCH_CALLS as MAX_BATCH_CALLS,
  SHARD_RPC_MAX_REQUEST_BYTES as MAX_REQUEST_BYTES,
} from "../../packages/value-ledger/src/shard-rpc-limits";
import { readOnlyRpc, startReadOnlyRpc } from "./read-only-rpc";

const received: { path: string; body: unknown }[] = [];
const node = Bun.serve({
  port: 0,
  async fetch(request) {
    const body = await request.json();
    received.push({ path: new URL(request.url).pathname, body });
    const answer = (call: { id: unknown }) => ({ jsonrpc: "2.0", id: call.id, result: "0x1" });
    return Response.json(Array.isArray(body) ? body.map(answer) : answer(body));
  },
});
afterAll(() => node.stop());
const serve = readOnlyRpc(new URL(`http://127.0.0.1:${node.port}`));
const send = (payload: unknown, init: RequestInit = {}, path = "/rpc/v0_10_2") =>
  serve(new Request(`http://rpc:8080${path}`, { method: "POST", body: JSON.stringify(payload), ...init }));
const call = (method: string, id = 1) => ({ jsonrpc: "2.0", id, method, params: [] });

test("every public read reaches the node on its own path, alone or in a batch", async () => {
  for (const method of READ_METHODS) {
    received.length = 0;
    const response = await send(call(method));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 1, result: "0x1" });
    expect(received).toEqual([{ path: "/rpc/v0_10_2", body: call(method) }]);
  }
  received.length = 0;
  const batch = [
    call("starknet_blockNumber", 1),
    call("starknet_getEvents", 2),
    call("starknet_getTransactionReceipt", 3),
  ];
  expect(((await (await send(batch, {}, "/")).json()) as unknown[]).length).toBe(3);
  expect(received).toEqual([{ path: "/", body: batch }]);
});

test("every write is refused with the closure message, alone or beside reads, and never reaches the node", async () => {
  received.length = 0;
  for (const payload of [
    ...[...WRITE_METHODS].map((method) => call(method)),
    [call("starknet_chainId"), call("starknet_addInvokeTransaction", 2)],
  ]) {
    const response = await send(payload);
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: unknown }).error).toEqual({
      code: -32010,
      message: WRITES_CLOSED_MESSAGE,
    });
  }
  expect(received).toEqual([]);
});

test("nothing outside the public reads is served", async () => {
  received.length = 0;
  for (const method of ["starknet_estimateFee", "starknet_simulateTransactions", "madara_V0_1_0_ping", "rpc_methods"])
    expect(((await (await send(call(method))).json()) as { error: { code: number } }).error.code).toBe(-32601);
  expect((await send({ id: 1, method: "starknet_chainId" })).status).toBe(200);
  expect(
    ((await (await send({ id: 1, method: "starknet_chainId" })).json()) as { error?: unknown }).error,
  ).toBeTruthy();
  expect((await send(call("starknet_chainId"), {}, "/admin")).status).toBe(404);
  expect((await serve(new Request("http://rpc:8080/", { method: "GET" }))).status).toBe(405);
  expect((await send(undefined, { body: "not json" })).status).toBe(400);
  expect((await send([])).status).toBe(200);
  expect(received).toEqual([]);
});

test("a node that doesn't answer is reported unavailable", async () => {
  const unreachable = readOnlyRpc(new URL("http://127.0.0.1:9"));
  const response = await unreachable(
    new Request("http://rpc:8080/", { method: "POST", body: JSON.stringify(call("starknet_chainId")) }),
  );
  expect(response.status).toBe(502);
});

/** One read whose JSON body is exactly `bytes` long. */
const readOfSize = (bytes: number) => {
  const empty = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_call", params: [""] });
  return JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_call", params: ["a".repeat(bytes - empty.length)] });
};

test("the public batch bound: the maximum is forwarded, one more call never reaches the node", async () => {
  received.length = 0;
  const batch = (size: number) => Array.from({ length: size }, (_, id) => call("starknet_blockNumber", id));
  expect(((await (await send(batch(MAX_BATCH_CALLS))).json()) as unknown[]).length).toBe(MAX_BATCH_CALLS);
  expect(received.length).toBe(1);
  received.length = 0;
  const refused = await send(batch(MAX_BATCH_CALLS + 1));
  expect(((await refused.json()) as { error: unknown }).error).toEqual({
    code: -32600,
    message: `RPC batch exceeds ${MAX_BATCH_CALLS} calls`,
  });
  expect(received).toEqual([]);
});

test("the public request bound: the maximum is forwarded, one byte more never reaches the node", async () => {
  received.length = 0;
  expect(readOfSize(MAX_REQUEST_BYTES).length).toBe(MAX_REQUEST_BYTES);
  expect(
    (await serve(new Request("http://rpc:8080/", { method: "POST", body: readOfSize(MAX_REQUEST_BYTES) }))).status,
  ).toBe(200);
  expect(received.length).toBe(1);
  received.length = 0;
  const larger = await serve(
    new Request("http://rpc:8080/", { method: "POST", body: readOfSize(MAX_REQUEST_BYTES + 1) }),
  );
  expect(larger.status).toBe(413);
  // A declared length past the bound is refused before the body is read.
  const declared = await serve(
    new Request("http://rpc:8080/", {
      method: "POST",
      body: readOfSize(64),
      headers: { "content-length": String(MAX_REQUEST_BYTES + 1) },
    }),
  );
  expect(declared.status).toBe(413);
  expect(received).toEqual([]);
});

test("the stand-in's server holds the request bound before its handler", async () => {
  const server = startReadOnlyRpc(new URL(`http://127.0.0.1:${node.port}`), 0, "127.0.0.1");
  try {
    received.length = 0;
    const post = (body: string) => fetch(`http://127.0.0.1:${server.port}/`, { method: "POST", body });
    expect((await post(readOfSize(MAX_REQUEST_BYTES))).status).toBe(200);
    expect(received.length).toBe(1);
    received.length = 0;
    expect((await post(readOfSize(MAX_REQUEST_BYTES + 1))).status).toBe(413);
    expect(received).toEqual([]);
  } finally {
    server.stop(true);
  }
});
