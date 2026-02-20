import { describe, expect, it } from "vitest";

import { normalizeU32TrialId } from "./index";

describe("normalizeU32TrialId", () => {
  it("accepts valid trial ids in u32 range", () => {
    expect(normalizeU32TrialId(0)).toBe("0");
    expect(normalizeU32TrialId(4294967295n)).toBe("4294967295");
  });

  it("rejects negative trial ids", () => {
    expect(() => normalizeU32TrialId(-1)).toThrow(/non-negative integer/);
  });

  it("rejects trial ids greater than u32::MAX", () => {
    expect(() => normalizeU32TrialId(4294967296n)).toThrow(/u32::MAX/);
  });
});
