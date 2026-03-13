import { describe, expect, it } from "vitest";
import { SHADER_PORTABILITY_INVENTORY } from "./shader-portability-inventory";

describe("shader portability inventory", () => {
  it("categorizes every required first-pass WebGPU migration surface", () => {
    expect(SHADER_PORTABILITY_INVENTORY).toEqual({
      "fx-manager.ts": {
        strategy: "rewrite",
      },
      "highlight-hex-material.ts": {
        strategy: "replace",
      },
      "hover-hex-material.ts": {
        strategy: "replace",
      },
      "label-stack.ts": {
        strategy: "keep",
      },
      "path-line-material.ts": {
        strategy: "rewrite",
      },
      "points-label-material.ts": {
        strategy: "redesign",
      },
      "resource-fx-manager.ts": {
        strategy: "replace",
      },
      "selection-pulse-material.ts": {
        strategy: "replace",
      },
    });
  });
});
