import { expect, test } from "bun:test";
import { startReadRpc } from "../scripts/read-rpc";
import { identity, invoke } from "./fixtures";
import { STAMP_TAG, type PlayInvoke } from "./transaction";

async function fixture(result: unknown = { transaction_hash: "0x777" }) {
  const forwarded: any[] = [],
    stamped: PlayInvoke[] = [];
  let nonce = "0x0";
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      if (call.method === "starknet_getNonce") return Response.json({ result: nonce });
      if (call.method === "starknet_getClassHashAt") return Response.json({ result: identity.accountClassHash });
      forwarded.push(call);
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        ...(result instanceof Error
          ? { error: { code: 99, message: result.message, data: { signature: call.params[0].signature } } }
          : { result }),
      });
    },
  });
  const stamper = {
    async stamp(tx: PlayInvoke) {
      stamped.push(tx);
      return { transactionHash: "0x777", suffix: [STAMP_TAG, "0x1", "0x2", "0x3", "0x4", "0x5"] };
    },
  };
  const proxy = startReadRpc(node.url.origin, 0, identity, stamper, undefined, "127.0.0.1");
  return {
    forwarded,
    stamped,
    setNonce(value: string) {
      nonce = value;
    },
    async call(method: string, params: unknown) {
      return (
        await fetch(proxy.url, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 42, method, params }) })
      ).json();
    },
    close() {
      proxy.stop(true);
      node.stop(true);
    },
  };
}
test("one current-nonce play is stamped and only its hash reaches the device", async () => {
  const f = await fixture();
  try {
    expect(await f.call("starknet_addInvokeTransaction", [invoke()])).toEqual({
      jsonrpc: "2.0",
      id: 42,
      result: { transaction_hash: "0x777" },
    });
    expect(f.forwarded[0].params[0].signature).toEqual([
      ...invoke().signature,
      STAMP_TAG,
      "0x1",
      "0x2",
      "0x3",
      "0x4",
      "0x5",
    ]);
    f.setNonce("0x1");
    expect((await f.call("starknet_addInvokeTransaction", [invoke()])).error.message).toBe("Transaction refused");
    expect(f.stamped).toHaveLength(1);
  } finally {
    f.close();
  }
});
test("node rejection never leaks a stamped body, proof or backend diagnostic", async () => {
  const f = await fixture(new Error("private transaction diagnostic"));
  try {
    expect(await f.call("starknet_addInvokeTransaction", [invoke()])).toEqual({
      jsonrpc: "2.0",
      id: 42,
      error: { code: -32000, message: "Transaction refused" },
    });
  } finally {
    f.close();
  }
});
test("estimates, simulation, future nonces, altered bounds, body and trace reads never get a proof", async () => {
  const f = await fixture();
  try {
    for (const method of ["starknet_estimateFee", "starknet_simulateTransactions"])
      expect((await f.call(method, [[invoke()], [], "pre_confirmed"])).error).toBeDefined();
    for (const method of [
      "starknet_getTransactionByHash",
      "starknet_getBlockWithTxs",
      "starknet_getBlockWithReceipts",
      "starknet_traceTransaction",
      "starknet_traceBlockTransactions",
      "starknet_getTransactionByBlockIdAndIndex",
    ])
      expect((await f.call(method, ["0x777"])).error).toBeDefined();
    for (const tx of [
      { ...invoke(), nonce: "0x1" },
      { ...invoke(), tip: "0x1" },
      { ...invoke(), calldata: ["0x2", ...invoke().calldata.slice(1)] },
    ])
      expect((await f.call("starknet_addInvokeTransaction", [tx])).error).toBeDefined();
    expect(f.stamped).toHaveLength(0);
    expect(f.forwarded).toHaveLength(0);
  } finally {
    f.close();
  }
});
