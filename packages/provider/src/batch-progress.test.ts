import { expect, it } from "vitest";
import { batchRemaining } from "./batch-progress";
import { batchRemaining as receiptRemaining } from "./native-receipt";
it("exposes the same decoder with explicit missing-event policy on both paths", () => {
  expect(receiptRemaining).toBe(batchRemaining);
  expect(batchRemaining([], "0x10", "0xabc", { missing: "allow" })).toBeUndefined();
  expect(() => batchRemaining([], "0x10", "0xabc", { missing: "reject", gameId: 7 })).toThrow();
});
