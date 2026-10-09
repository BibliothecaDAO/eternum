import { GAME_ENTRYPOINTS } from "./entrypoints";
import { hash } from "starknet";
import { expect, test } from "bun:test";
import { startReadRpc } from "../scripts/read-rpc";
import { identity, invoke } from "./fixtures";
import { STAMP_TAG, type PlayInvoke } from "./transaction";

async function fixture(result: unknown = { transaction_hash: "0x777" }, hold?: (tx: PlayInvoke) => Promise<void>) {
  const forwarded: any[] = [],
    stamped: PlayInvoke[] = [];
  const inspected: string[] = [];
  let nonce = "0x0";
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      if (call.method === "starknet_getNonce") {
        inspected.push(call.method);
        return Response.json({ result: nonce });
      }
      if (call.method === "starknet_getClassHashAt") {
        inspected.push(call.method);
        return Response.json({ result: identity.accountClassHash });
      }
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
      await hold?.(tx);
      return { transactionHash: "0x777", suffix: [STAMP_TAG, "0x1", "0x2", "0x3", "0x4", "0x5"] };
    },
  };
  const proxy = startReadRpc(node.url.origin, 0, identity, stamper, undefined, "127.0.0.1");
  return {
    forwarded,
    stamped,
    inspected,
    setNonce(value: string) {
      nonce = value;
    },
    async call(method: string, params: unknown) {
      return (
        await fetch(proxy.url, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 42, method, params }) })
      ).json();
    },
    async batch(transactions: PlayInvoke[]) {
      return (
        await fetch(proxy.url, {
          method: "POST",
          body: JSON.stringify(
            transactions.map((transaction, id) => ({
              jsonrpc: "2.0",
              id,
              method: "starknet_addInvokeTransaction",
              params: [transaction],
            })),
          ),
        })
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

test("2000 distinct accounts on one IP bypass enrollment limits, which still cap enrollment", async () => {
  const f = await fixture();
  try {
    // Twenty requests avoid the local HTTP client's connection cap; all 2000 invokes release together.
    const batches = await Promise.all(
      Array.from({ length: 20 }, (_, batch) =>
        f.batch(
          Array.from({ length: 100 }, (_, index) => ({
            ...invoke(),
            sender_address: `0x${(0x1000 + batch * 100 + index).toString(16)}`,
          })),
        ),
      ),
    );
    const answers = batches.flat();
    expect(answers).toHaveLength(2000);
    expect(f.forwarded).toHaveLength(2000);
    expect(answers.every((answer) => answer.result?.transaction_hash === "0x777")).toBe(true);
    expect(f.stamped).toHaveLength(2000);
    const deploy = {
      type: "DEPLOY_ACCOUNT",
      version: "0x3",
      tip: "0x0",
      class_hash: identity.accountClassHash,
      constructor_calldata: ["0x42", identity.guardianPublicKey],
      contract_address_salt: "0x42",
      signature: ["0x1", "0x2", "0x3", "0x4", "0x5"],
    };
    for (let index = 0; index < 30; index++)
      expect((await f.call("starknet_addDeployAccountTransaction", [deploy])).result.transaction_hash).toBe("0x777");
    expect((await f.call("starknet_addDeployAccountTransaction", [deploy])).error.code).toBe(-32005);
    expect(f.stamped).toHaveLength(2000);
  } finally {
    f.close();
  }
}, 30000);

test("one pending dispatch per account refuses overlap while another account proceeds", async () => {
  let release!: () => void, started!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = await fixture(undefined, async (tx) => {
    if (tx.sender_address === "0x42") {
      started();
      await blocked;
    }
  });
  const timeout = setTimeout(release, 1000);
  const pending = f.call("starknet_addInvokeTransaction", [invoke()]);
  try {
    await entered;
    expect((await f.call("starknet_addInvokeTransaction", [invoke()])).error.message).toBe("Transaction refused");
    expect(
      (await f.call("starknet_addInvokeTransaction", [{ ...invoke(), sender_address: "0x43" }])).result
        .transaction_hash,
    ).toBe("0x777");
    release();
    expect((await pending).result.transaction_hash).toBe("0x777");
    expect(f.stamped).toHaveLength(2);
    expect((await f.call("starknet_addInvokeTransaction", [invoke()])).result.transaction_hash).toBe("0x777");
  } finally {
    clearTimeout(timeout);
    release();
    await pending;
    f.close();
  }
});

test("the same endpoint forwards role-guarded administration without a second role or account list", async () => {
  const f = await fixture();
  try {
    for (const entry of GAME_ENTRYPOINTS.filter((entry) => !entry.stamp)) {
      const tx = {
        ...invoke(),
        sender_address: "0x999",
        signature: ["0x2", "0x3"],
        calldata: ["0x1", identity.games, hash.getSelectorFromName(entry.name), "0x1", "0x1"],
      };
      expect(await f.call("starknet_addInvokeTransaction", { invoke_transaction: tx })).toEqual({
        jsonrpc: "2.0",
        id: 42,
        result: { transaction_hash: "0x777" },
      });
      expect(f.forwarded.at(-1).params[0].signature).toEqual(tx.signature);
    }
    expect(f.stamped).toHaveLength(0);
    expect(f.inspected).toHaveLength(0);
    // Seating is command7 through play: its roster permutation must use the authenticated root.
    const settle = invoke();
    settle.calldata[8] = "0x7";
    expect((await f.call("starknet_addInvokeTransaction", [settle])).result.transaction_hash).toBe("0x777");
    expect(f.stamped).toHaveLength(1);
    expect(f.forwarded.at(-1).params[0].signature).toHaveLength(9);
    for (const name of ["create_explorer", "settle_blitz_roster", "set_vrf_public_key", "execute"]) {
      const tx = { ...invoke(), calldata: ["0x1", identity.games, hash.getSelectorFromName(name), "0x1", "0x1"] };
      expect((await f.call("starknet_addInvokeTransaction", [tx])).error).toBeDefined();
    }
  } finally {
    f.close();
  }
});
test("administrative contract refusal uses the fixed error and never returns diagnostics", async () => {
  const f = await fixture(new Error("not launcher diagnostic"));
  try {
    const tx = {
      ...invoke(),
      calldata: ["0x1", identity.games, hash.getSelectorFromName("create_game"), "0x1", "0x1"],
    };
    expect(await f.call("starknet_addInvokeTransaction", [tx])).toEqual({
      jsonrpc: "2.0",
      id: 42,
      error: { code: -32000, message: "Transaction refused" },
    });
    expect(f.stamped).toHaveLength(0);
  } finally {
    f.close();
  }
});
