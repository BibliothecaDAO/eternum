// @vitest-environment node
import { Account, hash, RpcProvider, type InvocationsSignerDetails } from "starknet";
import { expect, it, vi } from "vitest";

import { executeGameplayAccountTransaction } from "./submit";

/** The actual SDK signs and sends; the node checks the nonce and Herald acknowledges the received frame. */
function node(address: string) {
  let nonce = 7n;
  const methods: string[] = [];
  const attempted: bigint[] = [];
  const reported = new Map<string, (value: { hash: string; block: null; status: string }) => void>();
  const fetch: typeof globalThis.fetch = async (_url, request) => {
    const { id, method, params } = JSON.parse(String(request?.body));
    methods.push(method);
    let result: unknown;
    if (method === "starknet_getNonce") result = `0x${nonce.toString(16)}`;
    else if (method === "starknet_chainId") result = "0x1";
    else if (method === "starknet_addInvokeTransaction") {
      const tx = params.invoke_transaction;
      attempted.push(BigInt(tx.nonce));
      if (BigInt(tx.nonce) !== nonce)
        return Response.json({ jsonrpc: "2.0", id, error: { code: 52, message: "Invalid transaction nonce" } });
      nonce++;
      const bounds = (value: { max_amount: string; max_price_per_unit: string }) => ({
        max_amount: BigInt(value.max_amount),
        max_price_per_unit: BigInt(value.max_price_per_unit),
      });
      const transactionHash = hash.calculateInvokeTransactionHash({
        senderAddress: tx.sender_address,
        version: tx.version,
        compiledCalldata: tx.calldata,
        chainId: "0x1" as InvocationsSignerDetails["chainId"],
        nonce: tx.nonce,
        tip: tx.tip,
        accountDeploymentData: tx.account_deployment_data,
        paymasterData: tx.paymaster_data,
        nonceDataAvailabilityMode: 0,
        feeDataAvailabilityMode: 0,
        resourceBounds: {
          l1_gas: bounds(tx.resource_bounds.l1_gas),
          l2_gas: bounds(tx.resource_bounds.l2_gas),
          l1_data_gas: bounds(tx.resource_bounds.l1_data_gas),
        },
      });
      // The RPC may pad a felt while the locally computed hash does not.
      result = { transaction_hash: `0x${transactionHash.slice(2).padStart(64, "0")}` };
      setTimeout(
        () => reported.get(transactionHash)?.({ hash: transactionHash, block: null, status: "PRE_CONFIRMED" }),
        0,
      );
    } else throw new Error(`Unexpected RPC ${method}`);
    return Response.json({ jsonrpc: "2.0", id, result });
  };
  const account = new Account({
    provider: new RpcProvider({ nodeUrl: "http://submit.test", specVersion: "0.9.0", baseFetch: fetch }),
    address,
    signer: "0x1234",
    cairoVersion: "1",
  });
  const waitForTransaction = vi.fn(
    (transactionHash: string) =>
      new Promise<{ hash: string; block: null; status: string }>((resolve) =>
        reported.set(`0x${BigInt(transactionHash).toString(16)}`, resolve),
      ),
  );
  return {
    methods,
    attempted,
    waitForTransaction,
    resetNonce: (value: bigint) => {
      nonce = value;
    },
    send: () =>
      executeGameplayAccountTransaction({
        account,
        shard: { chainId: "0x1", l2GasBound: 0x1234n },
        calls: { contractAddress: "0x77", entrypoint: "play", calldata: ["1", "2", "3", "1", "4"] },
        waitForTransaction,
      }),
  };
}

it("five SDK sends read one nonce, use the shard's chain id and retain the nonce across padded hashes", async () => {
  const rpc = node("0x500001");
  for (let action = 0; action < 5; action++) await (await rpc.send()).inBlock;
  expect(rpc.attempted).toEqual([7n, 8n, 9n, 10n, 11n]);
  expect(rpc.methods.filter((method) => method === "starknet_getNonce")).toHaveLength(1);
  expect(rpc.methods.filter((method) => method === "starknet_chainId")).toHaveLength(0);
  expect(rpc.waitForTransaction).toHaveBeenCalledTimes(5);
});

it("an invalid nonce is refused immediately; only the next requested send re-reads and uses the node's nonce", async () => {
  const rpc = node("0x500002");
  await (
    await rpc.send()
  ).inBlock;
  rpc.resetNonce(3n);
  await expect(rpc.send()).rejects.toMatchObject({ cause: { baseError: { code: 52 } } });
  expect(rpc.attempted).toEqual([7n, 8n]);
  await (
    await rpc.send()
  ).inBlock;
  await (
    await rpc.send()
  ).inBlock;
  expect(rpc.attempted).toEqual([7n, 8n, 3n, 4n]);
  expect(rpc.methods.filter((method) => method === "starknet_getNonce")).toHaveLength(2);
});
