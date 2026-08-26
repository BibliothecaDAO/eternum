import { describe, expect, it } from "vitest";
import { classifyTransactionError, extractErrorMessage, formatErrorForConsole } from "./classify-transaction-error";

describe("classifyTransactionError", () => {
  describe("resource bounds", () => {
    it("classifies Madara's zero-bound validation failure", () => {
      expect(classifyTransactionError(new Error("Account validation failed: Out of gas"))).toEqual({
        kind: "resource_bounds",
        reason: "Account validation failed: Out of gas",
      });
      expect(classifyTransactionError(new Error("transaction failed: out-of-gas")).kind).toBe("resource_bounds");
    });

    it("classifies nested resource-bound overflows before generic reverts", () => {
      expect(
        classifyTransactionError({
          message: "Transaction execution error",
          data: { execution_error: "Execution reverted: L2 gas resource bounds exceeded" },
        }).kind,
      ).toBe("resource_bounds");
      expect(classifyTransactionError(new Error("resource-bounds overflow")).kind).toBe("resource_bounds");
    });

    it("classifies fee ceilings as resource-bound failures", () => {
      expect(classifyTransactionError(new Error("max fee too low")).kind).toBe("resource_bounds");
    });
  });

  describe("user cancels", () => {
    it("classifies wallet-rejection strings as user_cancelled", () => {
      expect(classifyTransactionError("User rejected the transaction").kind).toBe("user_cancelled");
      expect(classifyTransactionError(new Error("Transaction rejected")).kind).toBe("user_cancelled");
      expect(classifyTransactionError({ message: "Request aborted" }).kind).toBe("user_cancelled");
    });
  });

  describe("revert-marker strings", () => {
    it("classifies a katana failure-reason string as reverted with the innermost panic text", () => {
      const classified = classifyTransactionError(
        "Transaction failed with reason: Execution failed. " +
          "Failure reason: 0x6e6f7420656e6f756768207374616d696e61 ('not enough stamina').",
      );
      expect(classified.kind).toBe("reverted");
      expect(classified.reason).toBe("not enough stamina");
    });

    it("classifies Error instances carrying revert markers as reverted", () => {
      const classified = classifyTransactionError(new Error("execution reverted: realm occupied"));
      expect(classified.kind).toBe("reverted");
      expect(classified.reason).toBe("realm occupied");
    });
  });

  describe("submit failures and unknowns", () => {
    it("classifies wrapped submit-failure strings as submit_failed", () => {
      expect(classifyTransactionError("Transaction failed to submit: Unknown error").kind).toBe("submit_failed");
      expect(
        classifyTransactionError(
          new Error("Transaction submission timed out after 20s before a transaction hash was returned"),
        ).kind,
      ).toBe("submit_failed");
    });

    it("classifies an unknown blob as unknown without inventing a reason", () => {
      expect(classifyTransactionError({ weird: true })).toEqual({ kind: "unknown" });
    });
  });
});

describe("extractErrorMessage", () => {
  it("stays exported for message extraction (client re-exports it)", () => {
    expect(extractErrorMessage(new Error("one of the tiles in path is occupied"))).toBe(
      "one of the tiles in path is occupied",
    );
    expect(extractErrorMessage({ weird: true }, "fallback")).toBe("fallback");
  });
});

describe("formatErrorForConsole", () => {
  it("formats Error instances as one physical line", () => {
    expect(formatErrorForConsole(new Error("first line\nsecond line"))).toBe("first line second line");
  });

  it("formats string errors as one physical line", () => {
    expect(formatErrorForConsole("request failed\r\nretry exhausted")).toBe("request failed retry exhausted");
  });

  it("retains a decoded reason from a nested Starknet error", () => {
    expect(
      formatErrorForConsole({
        message: "Transaction execution error",
        data: {
          execution_error:
            "Execution failed. Failure reason: 0x6e6f7420656e6f756768207374616d696e61 ('not enough stamina').",
        },
      }),
    ).toBe("not enough stamina");
  });

  it("uses a useful fallback for unknown objects", () => {
    expect(formatErrorForConsole({ unexpected: true }, "unrecognized provider error")).toBe(
      "unrecognized provider error",
    );
  });
});
