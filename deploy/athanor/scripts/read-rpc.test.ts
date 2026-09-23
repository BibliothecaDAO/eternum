import { expect, test } from "bun:test";
import { startReadRpc } from "./read-rpc";
import { assertPublicRpcBoundary } from "./public-rpc-check";

test("public RPC forwards reads but never forwards writes, mixed batches, escaped methods or upgrades", async () => {
  const received: unknown[] = [];
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      received.push(await request.json());
      return Response.json({ jsonrpc: "2.0", id: 1, result: "0x123" });
    },
  });
  const proxy = startReadRpc(
    node.url.origin,
    0,
    { accountClassHash: "0x123", guardianPublicKey: "0x456" },
    undefined,
    "127.0.0.1",
  );
  const url = new URL("/rpc/v0_10_2", proxy.url).href;
  try {
    const result = await assertPublicRpcBoundary(url);
    expect(result.chainId).toBe("0x123");
    expect(received).toHaveLength(1);
    for (const body of [
      '{"jsonrpc":"2.0","id":1,"method":"starknet_\\u0061ddInvokeTransaction","params":[]}',
      '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","method":"starknet_addDeclareTransaction","params":[]}',
      '{"jsonrpc":"2.0","id":1,"method":"madara_addInvokeV0Transaction","params":[]}',
    ]) {
      const response = await fetch(url, { method: "POST", body });
      expect((await response.json()).error.code).toBe(-32601);
    }
    expect(received).toHaveLength(1);
    expect(
      await (
        await fetch(url, {
          method: "POST",
          body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "starknet_blockNumber", params: [] }),
        })
      ).json(),
    ).toEqual({ jsonrpc: "2.0", id: 1, result: "0x123" });
    expect(received).toHaveLength(2);
  } finally {
    proxy.stop(true);
    node.stop(true);
  }
});

test("the public audit rejects a directly exposed node even when malformed writes fail", async () => {
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const payload = await request.json();
      return Response.json(
        payload.method === "starknet_chainId"
          ? { result: "0x123" }
          : { error: { code: -32602, message: "Invalid params" } },
      );
    },
  });
  try {
    await expect(assertPublicRpcBoundary(node.url.href)).rejects.toThrow("not blocked before parameter validation");
  } finally {
    node.stop(true);
  }
});

import { hash } from "starknet";
import { rpcClientAddress } from "./rpc-client-limit";

test("only manifest-bound deploys and one self join/revoke pass the public transaction boundary", async () => {
  const identity = { accountClassHash: "0x123", guardianPublicKey: "0x456" };
  const forwarded: string[] = [];
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      if (call.method === "starknet_getClassHashAt")
        return Response.json({ result: call.params[1] === "0x99" ? "0x999" : identity.accountClassHash });
      forwarded.push(call.method);
      return Response.json({ jsonrpc: "2.0", id: 1, result: { transaction_hash: "0x777" } });
    },
  });
  const proxy = startReadRpc(node.url.origin, 0, identity, undefined, "127.0.0.1");
  const deploy = {
    type: "DEPLOY_ACCOUNT",
    version: "0x3",
    tip: "0x0",
    class_hash: "0x123",
    constructor_calldata: ["0x42", "0x456"],
    contract_address_salt: "0x42",
    signature: ["0x1", "0x2", "0x3", "0x4", "0x5"],
  };
  const join = {
    type: "INVOKE",
    version: "0x3",
    tip: "0x0",
    sender_address: "0x42",
    calldata: ["0x1", "0x42", hash.starknetKeccak("is_device").toString(), "0x1", "0x1"],
    signature: deploy.signature,
  };
  const revoke = {
    ...join,
    calldata: ["0x1", "0x42", hash.starknetKeccak("revoke_device").toString(), "0x3", "0x1", "0x2", "0x3"],
    signature: ["0x1", "0x2", "0x3"],
  };
  const submit = async (method: string, tx: unknown) =>
    await (
      await fetch(proxy.url, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [tx] }) })
    ).json();
  try {
    for (const tx of [
      { ...deploy, class_hash: "0x999" },
      { ...deploy, constructor_calldata: ["0x42", "0x999"] },
      { ...deploy, contract_address_salt: "0x99" },
    ]) {
      expect((await submit("starknet_addDeployAccountTransaction", tx)).error.code).toBe(-32601);
    }
    for (const tx of [
      { ...join, calldata: ["0x1", "0x99", ...join.calldata.slice(2)] },
      { ...join, calldata: [...join.calldata.slice(0, 2), "0x888", ...join.calldata.slice(3)] },
      { ...join, calldata: ["0x2", ...join.calldata.slice(1), ...join.calldata.slice(1)] },
      { ...join, sender_address: "0x99", calldata: ["0x1", "0x99", ...join.calldata.slice(2)] },
      { ...join, tip: "0x1" },
    ])
      expect((await submit("starknet_addInvokeTransaction", tx)).error.code).toBe(-32601);
    expect(forwarded).toHaveLength(0);
    for (const [method, tx] of [
      ["starknet_addDeployAccountTransaction", deploy],
      ["starknet_addInvokeTransaction", join],
      ["starknet_addInvokeTransaction", revoke],
    ] as const) {
      expect((await submit(method, tx)).result.transaction_hash).toBe("0x777");
    }
    expect(
      (await submit("starknet_estimateFee", [{ ...join, version: "0x100000000000000000000000000000003" }])).result,
    ).toBeDefined();
    expect((await submit("starknet_simulateTransactions", [join])).error.code).toBe(-32601);
    const query = { ...join, signature: [], version: "0x100000000000000000000000000000003" };
    const estimate = await fetch(proxy.url, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "starknet_estimateFee",
        params: { request: [query], simulation_flags: ["SKIP_VALIDATE"], block_id: "pre_confirmed" },
      }),
    });
    expect((await estimate.json()).result).toBeDefined();
    expect((await submit("starknet_addInvokeTransaction", { ...join, signature: [] })).error.code).toBe(-32601);
    expect((await submit("starknet_estimateFee", [query])).error.code).toBe(-32601);
    expect(forwarded).toHaveLength(5);
  } finally {
    proxy.stop(true);
    node.stop(true);
  }
});

test("only the configured tunnel peer may supply the last forwarded client address", () => {
  const headers = new Headers({ "x-forwarded-for": "10.9.9.9, 203.0.113.7", "cf-connecting-ip": "10.9.9.10" });
  expect(rpcClientAddress("172.19.0.1", "172.19.0.1", headers)).toBe("203.0.113.7");
  expect(rpcClientAddress("198.51.100.9", "172.19.0.1", headers)).toBe("198.51.100.9");
  expect(rpcClientAddress("172.19.0.1", undefined, headers)).toBe("172.19.0.1");
  expect(rpcClientAddress("172.19.0.1", "172.19.0.1", new Headers({ "x-forwarded-for": "203.0.113.7, invalid" }))).toBe(
    "172.19.0.1",
  );
});

test("forged forwarded prefixes cannot reset the trusted client's account request allowance", async () => {
  const proxy = startReadRpc(
    "http://127.0.0.1:1",
    0,
    { accountClassHash: "0x123", guardianPublicKey: "0x456" },
    "127.0.0.1",
    "127.0.0.1",
  );
  const request = (address: string) =>
    fetch(proxy.url, {
      method: "POST",
      headers: { "x-forwarded-for": address },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_addDeclareTransaction", params: [] }),
    });
  try {
    for (let n = 0; n < 30; n++) expect((await request(`10.0.0.${n}, 203.0.113.7`)).status).toBe(200);
    expect((await request("10.9.9.9, 203.0.113.7")).status).toBe(429);
    expect((await request("10.9.9.9, 203.0.113.8")).status).toBe(200);
  } finally {
    proxy.stop(true);
  }
});
