import { describe, expect, it } from "vitest";
import {
  getStructureVisibilityBucket,
  resolveVisibleStructureUpdateMode,
  shouldRefreshVisibleStructures,
} from "./structure-update-policy";

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

  it("allows incremental patching for visible structure moves when the model bucket is stable", () => {
    expect(
      resolveVisibleStructureUpdateMode({
        previous: {
          hexCoords: { col: 10, row: 10 },
          structureType: "Village",
          stage: 1,
          level: 1,
          isMine: false,
          isAlly: false,
          cosmeticId: "default",
          attachmentSignature: "",
        },
        next: {
          hexCoords: { col: 11, row: 10 },
          structureType: "Village",
          stage: 1,
          level: 1,
          isMine: true,
          isAlly: false,
          cosmeticId: "default",
          attachmentSignature: "",
        },
        wasVisible: true,
        isVisible: true,
      }),
    ).toBe("patch");
  });

  it("falls back to rebuild when the visible model bucket changes", () => {
    expect(
      resolveVisibleStructureUpdateMode({
        previous: {
          hexCoords: { col: 10, row: 10 },
          structureType: "Village",
          stage: 1,
          level: 1,
          isMine: false,
          isAlly: false,
          cosmeticId: "default",
          attachmentSignature: "",
        },
        next: {
          hexCoords: { col: 10, row: 10 },
          structureType: "Village",
          stage: 2,
          level: 1,
          isMine: false,
          isAlly: false,
          cosmeticId: "default",
          attachmentSignature: "",
        },
        wasVisible: true,
        isVisible: true,
      }),
    ).toBe("rebuild");
  });
});
