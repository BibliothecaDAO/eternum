import type { GetTransactionReceiptResponse } from "starknet";
import type { BatchTransactionReceipt } from "@bibliothecadao/types";

export function requireBatchReceipt(receipt: GetTransactionReceiptResponse): BatchTransactionReceipt {
  const remaining = (receipt as GetTransactionReceiptResponse & { batch_remaining?: string }).batch_remaining;
  if (remaining === undefined || !/^\d+$/.test(remaining))
    throw new Error("Native batch result missing from the receipt; send a new invoke to continue the batch");
  return Object.assign(receipt, { remaining: BigInt(remaining) });
}

export async function completeNativeBatches<T extends { remaining: bigint }>(submit: () => Promise<T>): Promise<T> {
  let previous: bigint | undefined;
  while (true) {
    const result = await submit();
    if (result.remaining === 0n) return result;
    if (result.remaining < 0n || (previous !== undefined && result.remaining >= previous))
      throw new Error("Native batch made no progress; complete its prerequisites before resuming");
    previous = result.remaining;
  }
}
