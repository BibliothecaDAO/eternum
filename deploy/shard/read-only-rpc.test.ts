import { afterAll, expect, test } from "bun:test";
import { READ_METHODS, WRITE_METHODS, WRITES_CLOSED_MESSAGE } from "../athanor/scripts/public-rpc";
import { readOnlyRpc } from "./read-only-rpc";

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
