import { InstancedBufferAttribute } from "three";
import { describe, expect, it } from "vitest";

import { markInstancedAttributeRangeDirty } from "./instanced-attribute-update-range";

const createAttribute = (capacity: number, itemSize: number): InstancedBufferAttribute => {
  return new InstancedBufferAttribute(new Float32Array(capacity * itemSize), itemSize);
};

describe("markInstancedAttributeRangeDirty", () => {
  it("converts matrix and color instance ranges to component offsets", () => {
    const matrices = createAttribute(16, 16);
    const colors = createAttribute(16, 3);

    markInstancedAttributeRangeDirty(matrices, 2, 3);
    markInstancedAttributeRangeDirty(colors, 4, 2);

    expect(matrices.updateRanges).toEqual([{ start: 32, count: 48 }]);
    expect(colors.updateRanges).toEqual([{ start: 12, count: 6 }]);
  });

  it("merges disjoint pending writes into one min-max range", () => {
    const matrices = createAttribute(16, 16);

    markInstancedAttributeRangeDirty(matrices, 2, 1);
    markInstancedAttributeRangeDirty(matrices, 8, 1);
    markInstancedAttributeRangeDirty(matrices, 5, 2);

    expect(matrices.updateRanges).toEqual([{ start: 32, count: 112 }]);
  });

  it("starts a fresh range after renderer-style range clearing", () => {
    const matrices = createAttribute(16, 16);

    markInstancedAttributeRangeDirty(matrices, 6, 2);
    const firstUploadVersion = matrices.version;
    matrices.clearUpdateRanges();
    markInstancedAttributeRangeDirty(matrices, 1, 1);

    expect(matrices.updateRanges).toEqual([{ start: 16, count: 16 }]);
    expect(matrices.version).toBe(firstUploadVersion + 1);
  });

  it("does not schedule an upload for an empty instance range", () => {
    const matrices = createAttribute(16, 16);

    markInstancedAttributeRangeDirty(matrices, 0, 0);

    expect(matrices.updateRanges).toEqual([]);
    expect(matrices.version).toBe(0);
  });
});
