import { expect, mock, test } from "bun:test";
import { RpcError, RpcProvider } from "starknet";
import { configureAccountConfirmation } from "./account-confirmation";

test("setup waits for confirmed success across RECEIVED and repeated missing-status observations", async () => {
  const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:1" });
  let observations = 0;
  const receipt = { block_number: 454, execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2" } as Awaited<
    ReturnType<RpcProvider["getTransactionReceipt"]>
  >;
  const getTransactionStatus = mock(async () => {
    observations += 1;
    if (observations === 1) return { finality_status: "RECEIVED" };
    if (observations <= 5)
      throw new RpcError({ code: 29, message: "Transaction hash not found" }, "starknet_getTransactionStatus", []);
    return { finality_status: "ACCEPTED_ON_L2" };
  });
  const getTransactionReceipt = mock(async () => receipt);
  Object.assign(provider, { getTransactionStatus, getTransactionReceipt });
  configureAccountConfirmation(provider);

  expect(await provider.waitForTransaction("0x1")).toEqual(receipt);
  expect(observations).toBe(6);
  expect(getTransactionReceipt).toHaveBeenCalledTimes(1);
}, 10_000);

test("setup still refuses rejected transactions and reverted or unconfirmed receipts", async () => {
  for (const scenario of ["rejected", "reverted", "unconfirmed"] as const) {
    const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:1" });
    const receipt =
      scenario === "unconfirmed"
        ? { execution_status: "SUCCEEDED", finality_status: "PRE_CONFIRMED" }
        : { block_number: 1, execution_status: "REVERTED", finality_status: "ACCEPTED_ON_L2" };
    Object.assign(provider, {
      getTransactionStatus: async () => ({ finality_status: scenario === "rejected" ? "REJECTED" : "ACCEPTED_ON_L2" }),
      getTransactionReceipt: async () => receipt,
    });
    configureAccountConfirmation(provider);
    await expect(provider.waitForTransaction("0x1")).rejects.toThrow(
      scenario === "rejected" ? "rejected" : scenario === "reverted" ? "reverted" : "no confirmed block",
    );
  }
});
