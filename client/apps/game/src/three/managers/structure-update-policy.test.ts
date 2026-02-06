import { describe, expect, it } from "vitest";
import { getStructureVisibilityBucket, shouldRefreshVisibleStructures } from "./structure-update-policy";

describe("structure-update-policy", () => {
  it("maps ownership to stable visibility buckets", () => {
    expect(getStructureVisibilityBucket(true, false)).toBe("mine");
    expect(getStructureVisibilityBucket(false, true)).toBe("ally");
    expect(getStructureVisibilityBucket(false, false)).toBe("enemy");
  });

  it("requests refresh only when bucket changes", () => {
    expect(shouldRefreshVisibleStructures({ isMine: false, isAlly: false }, { isMine: false, isAlly: false })).toBe(
      false,
    );

    expect(shouldRefreshVisibleStructures({ isMine: false, isAlly: false }, { isMine: true, isAlly: false })).toBe(
      true,
    );
  });
});
