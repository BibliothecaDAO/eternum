import { describe, expect, it, vi } from "vitest";
import type { GetTransactionReceiptResponse } from "starknet";
import { completeNativeBatches, requireBatchReceipt } from "./native-batch";

describe("native batch completion", () => {
  it("never treats a transaction hash as batch completion", () => {
    expect(() => requireBatchReceipt({ transaction_hash: "0x44" } as GetTransactionReceiptResponse)).toThrow(
      "missing from the receipt",
    );
    const receipt = { transaction_hash: "0x44", batch_remaining: "1" } as unknown as GetTransactionReceiptResponse;
    expect(requireBatchReceipt(receipt).remaining).toBe(1n);
  });
  it("continues partial work and stops only at zero", async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce({ remaining: 9n })
      .mockResolvedValueOnce({ remaining: 1n })
      .mockResolvedValueOnce({ remaining: 0n });
    expect(await completeNativeBatches(submit)).toEqual({ remaining: 0n });
    expect(submit).toHaveBeenCalledTimes(3);
  });
  it("finishes empty work in one call", async () => {
    const submit = vi.fn().mockResolvedValue({ remaining: 0n });
    await completeNativeBatches(submit);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("stops a blocked cursor and resumes from the next recorded result", async () => {
    const blocked = vi.fn().mockResolvedValue({ remaining: 2n });
    await expect(completeNativeBatches(blocked)).rejects.toThrow("no progress");
    expect(blocked).toHaveBeenCalledTimes(2);
    const resumed = vi.fn().mockResolvedValueOnce({ remaining: 1n }).mockResolvedValueOnce({ remaining: 0n });
    await completeNativeBatches(resumed);
    expect(resumed).toHaveBeenCalledTimes(2);
  });
  it("propagates rejection without resubmission or claiming completion", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("Native action rejected"));
    await expect(completeNativeBatches(submit)).rejects.toThrow("Native action rejected");
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
