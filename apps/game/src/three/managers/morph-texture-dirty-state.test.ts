import { describe, expect, it } from "vitest";
import { writeMorphWeightsIfChanged } from "./morph-texture-dirty-state";

describe("writeMorphWeightsIfChanged", () => {
  it("does not dirty an unchanged morph row", () => {
    const target = new Float32Array([0, 0.25, 0.75, 0]);
    const source = new Float32Array([0.25, 0.75]);

    expect(writeMorphWeightsIfChanged(target, 1, source, 0, 2)).toBe(false);
    expect(Array.from(target)).toEqual([0, 0.25, 0.75, 0]);
  });

  it("copies and dirties a changed morph row", () => {
    const target = new Float32Array([0, 0.25, 0.75, 0]);
    const source = new Float32Array([9, 0.5, 0.5, 9]);

    expect(writeMorphWeightsIfChanged(target, 1, source, 1, 2)).toBe(true);
    expect(Array.from(target)).toEqual([0, 0.5, 0.5, 0]);
  });
});
