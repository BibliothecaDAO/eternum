import { describe, expect, it, vi } from "vitest";
import { hash, type GetTransactionReceiptResponse } from "starknet";
import { completeNativeBatches, nativeBatchRemaining, requireBatchReceipt } from "./native-batch";

function events(remaining = "1") {
  return [
    { from_address: "0x77", keys: [hash.getSelectorFromName("BatchProgress"), "7"], data: ["291", "3", remaining] },
    {
      from_address: "0x77",
      keys: [hash.getSelectorFromName("ExecutionRecorded")],
      data: ["7", "291", "3", "1", "8", "1", "0"],
    },
  ];
}

describe("recorded batch results", () => {
  it("keeps zero and large counts exact and ignores foreign emitters", () => {
    expect(nativeBatchRemaining(events("0"), "0x77")).toBe("0");
    expect(nativeBatchRemaining(events("9007199254740993"), "0x77")).toBe("9007199254740993");
    expect(nativeBatchRemaining(events(), "0x88")).toBeUndefined();
    expect(nativeBatchRemaining([events()[1]], "0x77")).toBeUndefined();
  });
  it.each([0, 1, 2, 3, 5])("rejects a result mismatching recorded field %i", (field) => {
    const raw = events();
    raw[1].data[field] = "0";
    expect(() => nativeBatchRemaining(raw, "0x77")).toThrow("does not match");
  });
  it("rejects ambiguous and malformed results", () => {
    const raw = events();
    expect(() => nativeBatchRemaining([...raw, raw[0]], "0x77")).toThrow("Ambiguous");
    expect(() => nativeBatchRemaining([raw[0]], "0x77")).toThrow("Missing");
    raw[0].data.push("9");
    expect(() => nativeBatchRemaining(raw, "0x77")).toThrow("Malformed");
    expect(() => nativeBatchRemaining(events(String(2n ** 64n)), "0x77")).toThrow("Invalid");
  });
  it("never treats a transaction hash as batch completion", () => {
    expect(() => requireBatchReceipt({ transaction_hash: "0x44" } as GetTransactionReceiptResponse)).toThrow(
      "not available",
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
