// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isVrfNotConsumedError } from "./transaction-failure-reporting";

describe("isVrfNotConsumedError", () => {
  it("matches the canonical 'VrfProvider: not consumed' signature", () => {
    expect(isVrfNotConsumedError(new Error("Transaction failed to submit: VrfProvider: not consumed"))).toBe(true);
  });

  it("matches case variants and minor punctuation differences", () => {
    expect(isVrfNotConsumedError("vrfprovider not consumed")).toBe(true);
    expect(isVrfNotConsumedError("VRF Provider — not consumed")).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isVrfNotConsumedError(new Error("insufficient stamina"))).toBe(false);
    expect(isVrfNotConsumedError(new Error("explorer_move reverted"))).toBe(false);
    expect(isVrfNotConsumedError(undefined)).toBe(false);
    expect(isVrfNotConsumedError(null)).toBe(false);
    expect(isVrfNotConsumedError("")).toBe(false);
  });
});
