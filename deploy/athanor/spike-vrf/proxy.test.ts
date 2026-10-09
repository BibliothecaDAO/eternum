import { VRF_STAMP_TAG } from "./wire";
import { expect, test } from "bun:test";
import { startReadRpc } from "./proxy";
import { hash } from "starknet";
import { fixture } from "./fixtures";

const identity = { accountClassHash: "0xcab", guardianPublicKey: "0x42", operatorAccountAddress: "0x999" };

test("the COPY forwards the stamped Games invoke and never exposes transaction bodies", async () => {
  const forwarded: any[] = [];
  let stamps = 0;
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = (await request.json()) as any;
      const result =
        call.method === "starknet_getClassHashAt"
          ? "0xabc"
          : call.method === "starknet_getNonce"
            ? "0x1"
            : { transaction_hash: "0x123" };
      if (call.method === "starknet_addInvokeTransaction") forwarded.push(call.params.invoke_transaction);
      return Response.json({ jsonrpc: "2.0", id: call.id, result });
    },
  });
  const proxy = startReadRpc(node.url.origin, 0, identity, undefined, "127.0.0.1", {
    games: "0x456",
    chain: "0x5350494b45",
    accountClass: "0xabc",
    stamp: async (tx) => {
      stamps++;
      return { ...tx, signature: [...tx.signature, VRF_STAMP_TAG, "0x4", "0x5", "0x6", "0x7", "0x8"] };
    },
  });
  try {
    const request = {
      jsonrpc: "2.0",
      id: 3,
      method: "starknet_addInvokeTransaction",
      params: { invoke_transaction: fixture() },
    };
    request.params.invoke_transaction.calldata[2] = hash.getSelectorFromName("create_explorer");
    const response = await fetch(proxy.url, { method: "POST", body: JSON.stringify(request) });
    expect(((await response.json()) as any).result.transaction_hash).toBe("0x123");
    expect(stamps).toBe(1);
    expect(forwarded[0].signature).toHaveLength(9);
    expect(request.params.invoke_transaction.signature).toHaveLength(3);
    for (const method of [
      "starknet_getTransactionByHash",
      "starknet_getBlockWithTxs",
      "starknet_getBlockWithReceipts",
      "starknet_getTransactionByBlockIdAndIndex",
    ]) {
      const denied = await fetch(proxy.url, {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 4, method, params: ["0x123"] }),
      });
      expect(((await denied.json()) as any).error.code).toBe(-32601);
    }
    expect(stamps).toBe(1);
  } finally {
    proxy.stop(true);
    node.stop(true);
  }
});

test("preflight refuses grinding, future nonce, multicall, other selector and fee-bound games without a stamp", async () => {
  let nonce = "0x1",
    stamps = 0;
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = (await request.json()) as any;
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        result: call.method === "starknet_getClassHashAt" ? "0xabc" : nonce,
      });
    },
  });
  const proxy = startReadRpc(node.url.origin, 0, identity, undefined, "127.0.0.1", {
    games: "0x456",
    chain: "0x5350494b45",
    accountClass: "0xabc",
    stamp: async (tx) => {
      stamps++;
      return tx;
    },
  });
  const send = (method: string, tx = fixture()) =>
    fetch(proxy.url, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { invoke_transaction: tx } }),
    });
  try {
    const variants = [
      { ...fixture(), nonce: "0x2" },
      { ...fixture(), version: "0x100000000000000000000000000000003" },
      { ...fixture(), calldata: ["0x2", ...fixture().calldata.slice(1)] },
      { ...fixture(), tip: "0x1" },
      {
        ...fixture(),
        resource_bounds: { ...fixture().resource_bounds, l2_gas: { max_amount: "0x1", max_price_per_unit: "0x0" } },
      },
      { ...fixture(), calldata: ["0x1", "0x456", hash.getSelectorFromName("register_preset"), "0x1", "0x1"] },
    ];
    for (const tx of variants)
      expect(((await (await send("starknet_addInvokeTransaction", tx)).json()) as any).error).toBeDefined();
    for (const method of [
      "starknet_estimateFee",
      "starknet_simulateTransactions",
      "starknet_traceTransaction",
      "starknet_traceBlockTransactions",
    ])
      expect(((await (await send(method)).json()) as any).error).toBeDefined();
    nonce = "0x2";
    expect(((await (await send("starknet_addInvokeTransaction")).json()) as any).error).toBeDefined();
    expect(stamps).toBe(0);
  } finally {
    proxy.stop(true);
    node.stop(true);
  }
});

test("upstream result extras and raw refusals cannot leak a forwarded-but-dropped stamp", async () => {
  let fail = false;
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = (await request.json()) as any;
      if (call.method !== "starknet_addInvokeTransaction")
        return Response.json({
          jsonrpc: "2.0",
          id: call.id,
          result: call.method === "starknet_getClassHashAt" ? "0xabc" : "0x1",
        });
      return Response.json(
        fail
          ? { jsonrpc: "2.0", id: call.id, error: { code: 99, message: "private-suffix", data: call } }
          : {
              jsonrpc: "2.0",
              id: call.id,
              result: { transaction_hash: "0x123", signature: call.params.invoke_transaction.signature },
            },
      );
    },
  });
  const proxy = startReadRpc(node.url.origin, 0, identity, undefined, "127.0.0.1", {
    games: "0x456",
    chain: "0x5350494b45",
    accountClass: "0xabc",
    stamp: async (tx) => ({ ...tx, signature: [...tx.signature, VRF_STAMP_TAG, "0x4", "0x5", "0x456", "0x7", "0x8"] }),
  });
  const send = () =>
    fetch(proxy.url, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "starknet_addInvokeTransaction",
        params: { invoke_transaction: fixture() },
      }),
    });
  try {
    expect(await (await send()).json()).toEqual({ jsonrpc: "2.0", id: 3, result: { transaction_hash: "0x123" } });
    fail = true;
    expect(await (await send()).json()).toEqual({
      jsonrpc: "2.0",
      id: 3,
      error: { code: -32000, message: "Transaction refused" },
    });
  } finally {
    proxy.stop(true);
    node.stop(true);
  }
});
