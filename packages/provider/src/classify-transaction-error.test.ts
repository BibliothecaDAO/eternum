import { describe, expect, it } from "vitest";
import { classifyTransactionError, extractErrorMessage } from "./classify-transaction-error";

describe("classifyTransactionError", () => {
  describe("user cancels", () => {
    it("classifies undefined as user_cancelled (Cartridge popup close)", () => {
      expect(classifyTransactionError(undefined)).toEqual({ kind: "user_cancelled" });
    });

    it("classifies null as user_cancelled", () => {
      expect(classifyTransactionError(null)).toEqual({ kind: "user_cancelled" });
    });

    it("classifies wallet-rejection strings as user_cancelled", () => {
      expect(classifyTransactionError("User rejected the transaction").kind).toBe("user_cancelled");
      expect(classifyTransactionError(new Error("Transaction rejected")).kind).toBe("user_cancelled");
      expect(classifyTransactionError({ message: "Request aborted" }).kind).toBe("user_cancelled");
    });
  });

  describe("Cartridge error code families", () => {
    it.each([132, 142, 143, 144, 146])("maps controller code %i to session_invalid", (code) => {
      expect(classifyTransactionError({ code, message: "session problem" })).toEqual({
        kind: "session_invalid",
        code,
      });
    });

    it.each([53, 54, 113])("maps controller code %i to insufficient_funds", (code) => {
      const classified = classifyTransactionError({ code, message: "account balance too low to cover fees" });
      expect(classified.kind).toBe("insufficient_funds");
      expect(classified.code).toBe(code);
      expect(classified.reason).toBe("account balance too low to cover fees");
    });

    it("maps code 41 to reverted with the reason parsed out of the Cairo trace in data", () => {
      const classified = classifyTransactionError({
        code: 41,
        message: "Transaction execution error",
        data: {
          execution_error:
            "Contract error: Execution failed. Failure reason: 0x506f70756c6174696f6e2065786365656473206361706163697479 ('Population exceeds capacity').",
        },
      });
      expect(classified.kind).toBe("reverted");
      expect(classified.code).toBe(41);
      expect(classified.reason).toBe("Population exceeds capacity");
    });

    it("maps code 55 (validation failure) to reverted", () => {
      const classified = classifyTransactionError({ code: 55, message: "not enough stamina" });
      expect(classified.kind).toBe("reverted");
      expect(classified.code).toBe(55);
      expect(classified.reason).toBe("not enough stamina");
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

    it("keeps an unrecognized controller code on the unknown classification", () => {
      const classified = classifyTransactionError({ code: 999, message: "something odd happened" });
      expect(classified.kind).toBe("unknown");
      expect(classified.code).toBe(999);
      expect(classified.reason).toBe("something odd happened");
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
