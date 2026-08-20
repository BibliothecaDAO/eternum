import { describe, expect, it } from "vitest";
import { classifyTransactionError, extractErrorMessage, formatErrorForConsole } from "./classify-transaction-error";

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

  // Shapes pinned from the Aug 19 playtest: the controller wraps katana's
  // submission-time rejection as {code: 41, message: "An error occurred
  // (TRANSACTION_EXECUTION_ERROR)", data: <Cairo trace>}. The wrapper must
  // classify as generic or the extractor returns it and the real revert
  // (which the automation resync predicate keys on) never surfaces.
  describe("Cartridge 'An error occurred (<CODE>)' wrapper", () => {
    const WRAPPER = "An error occurred (TRANSACTION_EXECUTION_ERROR)";
    const REVERT = "Insufficient Balance: COPPER (id: 32230, balance: 210000000000) < 796000000000";
    // data as the raw JSON text katana returns: \" and \n are escape
    // sequences inside the string, exactly as they appear on the wire.
    const RAW_JSON_TRACE =
      'Transaction execution error: {"execution_error":"Transaction execution has failed:\\n' +
      "0: Error in the called contract (contract address: 0x015b24, class hash: 0x0743c8, selector: 0x015d40):\\n" +
      "Execution failed. Failure reason:\\n" +
      "(0x617267656e742f6d756c746963616c6c2d6661696c6564 ('argent/multicall-failed'), 0x0 (''), " +
      `\\"${REVERT}\\", 0x454e545259504f494e545f4641494c4544 ('ENTRYPOINT_FAILED')).\\n",` +
      '"transaction_index":0}';

    it("digs past the wrapper into a raw-JSON trace in data and skips the multicall frame", () => {
      expect(extractErrorMessage({ code: 41, message: WRAPPER, data: RAW_JSON_TRACE })).toBe(REVERT);
    });

    it("digs past the wrapper into a parsed execution_error object in data", () => {
      const parsedTrace = {
        execution_error:
          "Transaction execution has failed:\nExecution failed. Failure reason:\n" +
          `(0x617267656e742f6d756c746963616c6c2d6661696c6564 ('argent/multicall-failed'), 0x0 (''), "${REVERT}", ` +
          "0x454e545259504f494e545f4641494c4544 ('ENTRYPOINT_FAILED')).",
      };
      expect(extractErrorMessage({ code: 41, message: WRAPPER, data: parsedTrace })).toBe(REVERT);
    });

    it("returns the fallback, never the wrapper, when data carries no trace", () => {
      expect(extractErrorMessage({ code: 41, message: WRAPPER }, "fallback")).toBe("fallback");
    });

    it("classifies the wrapped code-41 error as reverted with the real reason", () => {
      const classified = classifyTransactionError({ code: 41, message: WRAPPER, data: RAW_JSON_TRACE });
      expect(classified.kind).toBe("reverted");
      expect(classified.reason).toBe(REVERT);
    });

    it("extracts the revert from a raw starknet.js estimateFee rejection (preflight abort path)", () => {
      const estimateError = new Error(`RPC: starknet_estimateFee with params {}\n\n 41: ${RAW_JSON_TRACE}`);
      expect(extractErrorMessage(estimateError)).toBe(REVERT);
    });
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
        code: 41,
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
