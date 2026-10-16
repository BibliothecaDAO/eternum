import { TransactionFailure } from "@bibliothecadao/provider/errors";
import { describe, expect, it } from "vitest";

import { isTransactionInFlight, statusAfterFailure } from "./use-transaction-store";

describe("a sent action's row after a failure", () => {
  it("says refused only for an outcome the shard or the game gave, not sent only on proof", () => {
    expect(statusAfterFailure({ stage: "revert" })).toBe("reverted");
    expect(statusAfterFailure({ stage: "submit", failureKind: "not_sent" })).toBe("not_sent");
    expect(statusAfterFailure({ stage: "confirmation", failureKind: "not_sent" })).toBe("not_sent");
  });

  it("says no answer, and stops counting the action in flight, when the client itself gave up waiting", () => {
    const noAnswer = Object.assign(new Error("No answer yet. This action may still apply."), {
      name: "TransactionNoAnswerError",
    });
    const status = statusAfterFailure({ stage: "confirmation", error: noAnswer });
    expect(status).toBe("no_answer");
    expect(isTransactionInFlight({ status })).toBe(false);
    // It is never proof of anything: a proven not-sent, or a refusal, still reads as itself.
    expect(statusAfterFailure({ stage: "submit", failureKind: "not_sent", error: noAnswer })).toBe("not_sent");
    expect(isTransactionInFlight({ status: "checking" })).toBe(true);
  });

  it("keeps checking when only the wait for the outcome failed: a lost session or a stopped client is no outcome", () => {
    expect(statusAfterFailure({ stage: "confirmation" })).toBe("checking");
    expect(statusAfterFailure({ stage: "background_confirmation" })).toBe("checking");
    expect(statusAfterFailure({ stage: "confirmation", error: new Error("session replaced") })).toBe("checking");
  });
});

it("keeps a typed no-answer pending outcome distinct from revert", () => {
  const error = new TransactionFailure({
    classification: { kind: "no_answer" },
    message: "No answer yet",
    cause: new Error("unknown"),
  });
  expect(statusAfterFailure({ stage: "confirmation", error })).toBe("no_answer");
  expect(statusAfterFailure({ stage: "revert", error })).toBe("reverted");
});
