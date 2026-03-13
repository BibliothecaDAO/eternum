import { describe, expect, it } from "vitest";
import { SHADER_PORTABILITY_INVENTORY } from "./shader-portability-inventory";

describe("shader portability inventory", () => {
  it("covers every custom shader module in the three shader directory", () => {
    expect(Object.keys(SHADER_PORTABILITY_INVENTORY).sort()).toEqual([
      "highlight-hex-material.ts",
      "hover-hex-material.ts",
      "path-line-material.ts",
      "points-label-material.ts",
      "selection-pulse-material.ts",
    ]);
  });
});
