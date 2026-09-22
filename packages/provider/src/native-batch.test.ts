import { describe, expect, it, vi } from "vitest";
import { hash, type GetTransactionReceiptResponse } from "starknet";
import {
  completeNativeBatches,
  nativeExecutionOutcomes,
  requireNativeExecutionOutcome,
  requireBatchReceipt,
} from "./native-batch";

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
  const ticket = { gameId: "7", actor: "0x123", nonce: "3", order: "8" };
  it("keeps zero and large counts exact and ignores foreign emitters", () => {
    expect(nativeExecutionOutcomes(events("0"), "0x77")[0].batchRemaining).toBe("0");
    expect(nativeExecutionOutcomes(events("9007199254740993"), "0x77")[0].batchRemaining).toBe("9007199254740993");
    expect(nativeExecutionOutcomes(events(), "0x88")).toEqual([]);
    expect(nativeExecutionOutcomes([events()[1]], "0x77")[0].batchRemaining).toBeUndefined();
  });
  it.each([0, 1, 2, 3, 5])("rejects a result mismatching recorded field %i", (field) => {
    const raw = events();
    raw[1].data[field] = "0";
    expect(() => nativeExecutionOutcomes(raw, "0x77")).toThrow();
  });
  it("rejects ambiguous and malformed results", () => {
    const raw = events();
    expect(() => nativeExecutionOutcomes([...raw, raw[0]], "0x77")).toThrow("Ambiguous");
    expect(() => nativeExecutionOutcomes([...raw, raw[1]], "0x77")).toThrow("Duplicate");
    expect(() => nativeExecutionOutcomes([raw[0]], "0x77")).toThrow("does not match");
    raw[0].data.push("9");
    expect(() => nativeExecutionOutcomes(raw, "0x77")).toThrow("Malformed");
    expect(() => nativeExecutionOutcomes(events(String(2n ** 64n)), "0x77")).toThrow("Invalid");
  });
  it("keeps outcomes and progress independent for tickets sharing a receipt", () => {
    // Another game's ticket at the same order resolves to its own outcome.
    const second = events("4");
    second[0].keys[1] = "9";
    second[0].data[0] = "292";
    second[1].data[0] = "9";
    second[1].data[1] = "292";
    const rejected = events()[1];
    rejected.data = ["7", "293", "3", "0", "10", "2", "0x5354414c455f4e4f4e4345"];
    const outcomes = nativeExecutionOutcomes([...events("9"), rejected, ...second], "0x77");
    expect(requireNativeExecutionOutcome(outcomes, ticket)).toMatchObject({ status: "SUCCEEDED", batchRemaining: "9" });
    expect(requireNativeExecutionOutcome(outcomes, { ...ticket, gameId: "9", actor: "292" })).toMatchObject({
      status: "SUCCEEDED",
      batchRemaining: "4",
    });
    expect(requireNativeExecutionOutcome(outcomes, { ...ticket, actor: "293", order: "10" })).toMatchObject({
      status: "REVERTED",
      reason: "STALE_NONCE",
      nonceConsumed: false,
    });
  });
  it("requires the accepted order, game, actor and nonce to match", () => {
    const outcomes = nativeExecutionOutcomes(events(), "0x77");
    expect(() => requireNativeExecutionOutcome(undefined, ticket)).toThrow("Missing");
    expect(() => requireNativeExecutionOutcome([...outcomes, ...outcomes], ticket)).toThrow("ambiguous");
    expect(() => requireNativeExecutionOutcome(outcomes, { ...ticket, order: "9" })).toThrow("Missing");
    expect(() => requireNativeExecutionOutcome(outcomes, { ...ticket, gameId: "9" })).toThrow("Missing");
    for (const field of ["actor", "nonce"] as const) {
      expect(() => requireNativeExecutionOutcome(outcomes, { ...ticket, [field]: "99" })).toThrow("identity mismatch");
    }
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
