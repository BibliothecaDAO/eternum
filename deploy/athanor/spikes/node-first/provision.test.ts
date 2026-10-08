import { expect, test } from "bun:test";
import { provisioningWindow, preconfirmedSuccess } from "./provision";
import { assertCreatedWave } from "./game-explore";
import { RpcProvider } from "starknet";
import type { Fixture } from "./common";

const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
test("provisioning submits a bounded window with consecutive nonces before any receipt", async () => {
  const sent: bigint[] = [];
  const finish: (() => void)[] = [];
  const completed: number[] = [];
  const work = provisioningWindow(
    5,
    42n,
    3,
    async (_index, nonce) => {
      sent.push(nonce);
      return String(nonce);
    },
    () =>
      new Promise<void>((ok) => {
        finish.push(ok);
      }),
    (count) => completed.push(count),
    async () => {},
  );
  await turn();
  expect(sent).toEqual([42n, 43n, 44n]);
  expect(completed).toEqual([]);
  finish[0]!();
  await turn();
  expect(sent).toEqual([42n, 43n, 44n, 45n]);
  finish[1]!();
  await turn();
  expect(sent).toEqual([42n, 43n, 44n, 45n, 46n]);
  finish.slice(2).forEach((ok) => ok());
  await work;
  expect(completed).toEqual([1, 2, 3, 4, 5]);
});
test("a nonce failure stops provisioning and reports the batch instead of publishing partial success", async () => {
  const sent: bigint[] = [];
  await expect(
    provisioningWindow(
      10,
      8n,
      3,
      async (_index, nonce) => {
        sent.push(nonce);
        return String(nonce);
      },
      async (hash) => {
        if (hash === "9") throw new Error("reverted");
      },
      () => {},
      async () => {},
    ),
  ).rejects.toThrow("nonce 9 failed");
  expect(sent.length).toBeLessThan(10);
});
test("preconfirmed success releases a flight without waiting for a block close", async () => {
  const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:38000" });
  provider.getTransactionReceipt = async () =>
    ({ execution_status: "SUCCEEDED", finality_status: "PRE_CONFIRMED" }) as Awaited<
      ReturnType<RpcProvider["getTransactionReceipt"]>
    >;
  await preconfirmedSuccess(provider, "0x1");
  provider.getTransactionReceipt = async () =>
    ({ execution_status: "REVERTED", finality_status: "PRE_CONFIRMED" }) as Awaited<
      ReturnType<RpcProvider["getTransactionReceipt"]>
    >;
  await expect(preconfirmedSuccess(provider, "0x1")).rejects.toThrow("reverted");
});
test("fixture reuse requires every creation to succeed, even when its latency target failed", () => {
  const fixture: Fixture = {
    chainId: "0x1",
    accountClassHash: "0x1",
    guardianPublicKey: "0x1",
    classHash: "0x1",
    contract: "0x123",
    players: [{ address: "0x2", privateKey: "0x1", publicKey: "0x1", botId: 0 }],
    entrypoint: "create_explorer",
    playerCalldata: [["1", "1", "0", "0", "1000", "0"]],
    game: { id: 1, arm: "X", kind: "CreateExplorer", initialCounter: 2 },
  };
  const result = {
    status: "finished",
    completed: 1,
    contract: "0x123",
    chainId: "0x1",
    game: { id: 1, arm: "X", kind: "CreateExplorer" },
    actions: [{ executionStatus: "SUCCEEDED", submitError: null }],
    passed: false,
  };
  expect(() => assertCreatedWave(fixture, result)).not.toThrow();
  expect(() => assertCreatedWave(fixture, { ...result, completed: 0 })).toThrow("incomplete");
  expect(() => assertCreatedWave(fixture, { ...result, game: { ...result.game, id: 2 } })).toThrow("another fixture");
  expect(() =>
    assertCreatedWave(fixture, { ...result, actions: [{ executionStatus: "REVERTED", submitError: null }] }),
  ).toThrow("incomplete");
});

test("explicit nonce and work bounds bypass SDK fee simulation and nonce reads", async () => {
  const { Account } = await import("starknet");
  const { invokeBounds } = await import("./common");
  const methods: string[] = [];
  const nonces: bigint[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      methods.push(call.method);
      if (call.method === "starknet_chainId") return Response.json({ jsonrpc: "2.0", id: call.id, result: "0x1" });
      if (call.method === "starknet_specVersion")
        return Response.json({ jsonrpc: "2.0", id: call.id, result: "0.9.0" });
      if (call.method === "starknet_addInvokeTransaction") {
        const tx = call.params.invoke_transaction ?? call.params[0];
        nonces.push(BigInt(tx.nonce));
        return Response.json({ jsonrpc: "2.0", id: call.id, result: { transaction_hash: `0x${nonces.length}` } });
      }
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        error: { code: -32601, message: "Unexpected setup read or simulation" },
      });
    },
  });
  try {
    const account = new Account({
      provider: new RpcProvider({ nodeUrl: `http://127.0.0.1:${server.port}` }),
      address: "0x456",
      signer: "0x1",
      cairoVersion: "1",
    });
    await provisioningWindow(
      3,
      17n,
      2,
      async (_index, nonce) =>
        (
          await account.execute(
            { contractAddress: "0x123", entrypoint: "prepare_home", calldata: [] },
            { nonce, tip: 0, resourceBounds: invokeBounds },
          )
        ).transaction_hash,
      async () => {},
      () => {},
      async () => {},
    );
    expect(nonces).toEqual([17n, 18n, 19n]);
    expect(methods.includes("starknet_getNonce")).toBe(false);
    expect(methods.includes("starknet_estimateFee")).toBe(false);
  } finally {
    await server.stop(true);
  }
});

test("pipeline waits for the final committed transaction before a default-nonce write", async () => {
  const events: string[] = [];
  await provisioningWindow(
    3,
    10n,
    2,
    async (_index, nonce) => String(nonce),
    async (hash) => {
      events.push(`preconfirmed:${hash}`);
    },
    () => {},
    async (hash) => {
      events.push(`confirmed:${hash}`);
    },
  );
  expect(events).toEqual(["preconfirmed:10", "preconfirmed:11", "preconfirmed:12", "confirmed:12"]);
});

test("presigning a scheduled nonce does not read an older projected nonce", async () => {
  const { presign } = await import("./common");
  const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:38000" });
  provider.getNonceForAddress = async () => {
    throw new Error("unexpected nonce read during schedule signing");
  };
  const player = { address: "0x456", privateKey: "0x1", publicKey: "0x1", botId: 0 };
  const fixture: Fixture = {
    chainId: "0x1",
    accountClassHash: "0x1",
    guardianPublicKey: "0x1",
    contract: "0x123",
    classHash: "0x1",
    players: [player],
    entrypoint: "explore",
    playerCalldata: [["1", "2", "3"]],
  };
  const signed = await presign(fixture, player, provider, 0, 1, 1, 1, 42n);
  expect(JSON.parse(signed.body).params[0].nonce).toBe("0x2a");
});
