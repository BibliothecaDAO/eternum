import { VRF_STAMP_TAG } from "./wire";
import { expect, test } from "bun:test";
import { fixture } from "./fixtures";
import { stampRequest, type Stamp } from "./stamp";

const context = () => {
  let calls = 0;
  const stamp: Stamp = {
    games: "0x456",
    chain: "0x5350494b45",
    accountClass: "0x123",
    stamp: async (tx) => {
      calls++;
      return { ...tx, signature: [...tx.signature, VRF_STAMP_TAG, "0x4", "0x5", "0x6", "0x7", "0x8"] };
    },
  };
  return { stamp, count: () => calls };
};

test("the proxy stamps only an addInvoke and forwards the original signature prefix", async () => {
  const { stamp, count } = context();
  const tx = fixture();
  const request = {
    jsonrpc: "2.0",
    id: 8,
    method: "starknet_addInvokeTransaction",
    params: { invoke_transaction: tx },
  };
  const result = await stampRequest(request, stamp);
  expect(count()).toBe(1);
  expect(result.params.invoke_transaction.signature.slice(0, 3)).toEqual(tx.signature);
  expect(result.params.invoke_transaction.signature).toHaveLength(9);
  expect(tx.signature).toHaveLength(3);
});

test("estimateFee, simulate and non-Games invokes never ask the prover", async () => {
  const { stamp, count } = context();
  for (const method of ["starknet_estimateFee", "starknet_simulateTransactions"]) {
    const request = { jsonrpc: "2.0", method, params: { transactions: [fixture()] } };
    expect(await stampRequest(request, stamp)).toBe(request);
  }
  const other = {
    jsonrpc: "2.0",
    method: "starknet_addInvokeTransaction",
    params: [{ ...fixture(), calldata: ["0x1", "0x999", "0x789", "0x0"] }],
  };
  expect(await stampRequest(other, stamp)).toBe(other);
  expect(count()).toBe(0);
});

test("positional addInvoke params preserve the request envelope and body", async () => {
  const { stamp } = context();
  const request = { jsonrpc: "2.0", id: "request", method: "starknet_addInvokeTransaction", params: [fixture()] };
  const result = await stampRequest(request, stamp);
  expect(result.id).toBe("request");
  expect(result.params[0].signature).toHaveLength(9);
  expect(request.params[0].signature).toHaveLength(3);
});
