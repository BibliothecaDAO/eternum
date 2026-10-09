import { expect, test } from "bun:test";
import { Account, byteArray, CallData, hash } from "starknet";
import { DeviceSigner, deviceKeyOf } from "@bibliothecadao/eternum";
import { classifyPlayReceipt } from "./player-actions";
import { readPlayBounds, signPlayerInvoke } from "./player-invoke";

const scope = { games: "0x123", gameId: 4, actor: "0x9", hash: "0x88" };
test("pending, reverted and successful receipts have distinct action states", () => {
  expect(classifyPlayReceipt({ execution_status: "SUCCEEDED" }, scope)).toEqual({ state: "pending" });
  expect(
    classifyPlayReceipt({ execution_status: "REVERTED", block_number: 12, revert_reason: "Wrong release" }, scope),
  ).toEqual({ state: "rejected", block: 12, reason: "Wrong release" });
  expect(classifyPlayReceipt({ execution_status: "SUCCEEDED", block_number: 12, events: [] }, scope)).toMatchObject({
    state: "applied",
    block: 12,
  });
});
test("GameplayRejected inside a successful invoke preserves the game's reason and verifies identity", () => {
  const event = {
    from_address: scope.games,
    keys: [hash.getSelectorFromName("GameplayRejected"), "1", "4", scope.actor, scope.hash],
    data: ["0x1", ...CallData.compile(byteArray.byteArrayFromString("not enough stamina"))],
  };
  const receipt = { execution_status: "SUCCEEDED", block_number: 12, events: [event] };
  expect(classifyPlayReceipt(receipt, scope)).toEqual({
    state: "rejected",
    block: 12,
    reason: "not enough stamina",
    statusClass: "0x1",
  });
  expect(() => classifyPlayReceipt(receipt, { ...scope, actor: "0x8" })).toThrow("identity");
});
test("manifest pins have no fallback", () => {
  expect(() => readPlayBounds({ shard: { chainId: "0x1" } })).toThrow("Manifest requires");
  expect(() =>
    readPlayBounds({ shard: { chainId: "0x1", vrfPublicKey: { x: "1", y: "2" }, l2GasBound: "0x01" } }),
  ).toThrow("canonical");
});
test("player signs one ordinary invoke at the RPC nonce with the manifest's exact fee-free bound", async () => {
  const account = new Account({
    provider: { nodeUrl: "http://127.0.0.1:1" },
    address: "0x9",
    signer: new DeviceSigner(deviceKeyOf("0x123")),
    cairoVersion: "1",
  });
  account.getNonce = async () => "0x7";
  const signed = await signPlayerInvoke(
    account,
    { contractAddress: "0x123", entrypoint: "play", calldata: ["4", "1", "8", "1", "0"] },
    { chainId: "0x534e5f5345504f4c4941", l2GasBound: "0x1234" },
  );
  const request = JSON.parse(signed.body);
  const transaction = request.params[0];
  expect(request.method).toBe("starknet_addInvokeTransaction");
  expect(transaction.nonce).toBe("0x7");
  expect(transaction.signature).toHaveLength(3);
  expect(transaction.calldata[0]).toBe("0x1");
  expect(transaction.resource_bounds.l2_gas).toEqual({ max_amount: "0x1234", max_price_per_unit: "0x0" });
  expect(transaction.resource_bounds.l1_gas.max_amount).toBe("0x0");
  expect(transaction.paymaster_data).toEqual([]);
  expect(signed.hash).toMatch(/^0x[0-9a-f]+$/);
});

test("one account cannot send again until its included action's Herald facts have arrived", async () => {
  const { playerActions, waitForPlayerAction } = await import("./player-actions");
  const bindings = (await import("../../../contracts/l3/world-native/schema/bindings.json")).default;
  let submitted = 0;
  const server = Bun.serve({
    port: 0,
    fetch: async () => {
      submitted++;
      return Response.json({ jsonrpc: "2.0", id: 1 });
    },
  });
  let applied!: () => void;
  const herald = new Promise<void>((resolve) => {
    applied = resolve;
  });
  let submit!: import("@bibliothecadao/provider").NativeSubmission;
  const provider = {
    setNativeSubmission: (callback: typeof submit) => {
      submit = callback;
    },
    setTransactionStreamWaiter() {},
    getTransactionReceipt: async () => ({ execution_status: "SUCCEEDED", block_number: 12, events: [] }),
  };
  const setup = { network: { provider }, store: { require: () => ({ release_id: 1, preset_commitment: 8 }) } };
  const runtime = { waitForTransaction: () => herald, recordSubmittedTransaction() {} };
  const dispose = playerActions({
    gameId: 4,
    actor: "0x9",
    games: "0x123",
    rpcUrl: `http://127.0.0.1:${server.port}`,
    provider: provider as never,
    bounds: { chainId: "0x534e5f5345504f4c4941", l2GasBound: "0x1234" },
    commandAbi: bindings.commandAbi as never,
  })(setup as never, runtime as never, { ready: async () => {} });
  const account = new Account({
    provider: { nodeUrl: "http://127.0.0.1:1" },
    address: "0x9",
    signer: new DeviceSigner(deviceKeyOf("0x123")),
    cairoVersion: "1",
  });
  let nonceReads = 0;
  account.getNonce = async () => String(nonceReads++);
  const call = {
    contractAddress: "0x123",
    entrypoint: "CreateExplorer",
    calldata: ["4", "0", "1", "0", "0", "1", "0"],
  };
  try {
    const first = await submit(account, call);
    let completed = false;
    const wait = waitForPlayerAction({ setup } as never, first.transaction_hash).then(() => {
      completed = true;
    });
    await Bun.sleep(20);
    expect(completed).toBe(false);
    await expect(submit(account, call)).rejects.toThrow("pending player action");
    expect(nonceReads).toBe(1);
    expect(submitted).toBe(1);
    applied();
    await wait;
    await submit(account, call);
    expect(nonceReads).toBe(2);
  } finally {
    dispose();
    server.stop(true);
  }
});

test("a player-signed shard opens without any gateway endpoint", async () => {
  const { openShard } = await import("@bibliothecadao/eternum/game-client");
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      Response.json({
        version: 1,
        chainId: "0x112233",
        releaseSchemas: { "1": "test-schema" },
        rpcUrl: "http://127.0.0.1:1",
        accountClassHash: "0x123",
        guardianPublicKey: "0x456",
        contracts: { games: "0x789" },
      }),
  });
  try {
    const shard = await openShard(`http://127.0.0.1:${server.port}`, "test-schema");
    expect(shard.admissionUrl).toBeUndefined();
    expect(shard.rpcUrl).toBe("http://127.0.0.1:1");
  } finally {
    server.stop(true);
  }
});
