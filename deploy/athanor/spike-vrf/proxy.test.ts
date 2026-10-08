import { expect, test } from "bun:test";
import { startReadRpc } from "./proxy";
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
      return { ...tx, signature: [...tx.signature, "0x4", "0x5", "0x6", "0x7", "0x8"] };
    },
  });
  try {
    const request = {
      jsonrpc: "2.0",
      id: 3,
      method: "starknet_addInvokeTransaction",
      params: { invoke_transaction: fixture() },
    };
    const response = await fetch(proxy.url, { method: "POST", body: JSON.stringify(request) });
    expect(((await response.json()) as any).result.transaction_hash).toBe("0x123");
    expect(stamps).toBe(1);
    expect(forwarded[0].signature).toHaveLength(8);
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
