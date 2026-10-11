import { describe, expect, it } from "vitest";

import { statusAfterFailure } from "./use-transaction-store";

describe("a sent action's row after a failure", () => {
  it("says refused only for an outcome the shard or the game gave, not sent only on proof", () => {
    expect(statusAfterFailure({ stage: "revert" })).toBe("reverted");
    expect(statusAfterFailure({ stage: "submit", failureKind: "not_sent" })).toBe("not_sent");
    expect(statusAfterFailure({ stage: "confirmation", failureKind: "not_sent" })).toBe("not_sent");
  });

  it("keeps checking when only the wait for the outcome failed: a lost session or a stopped client is no outcome", () => {
    expect(statusAfterFailure({ stage: "confirmation" })).toBe("checking");
    expect(statusAfterFailure({ stage: "background_confirmation" })).toBe("checking");
  });
});
