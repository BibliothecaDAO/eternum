import { describe, expect, it } from "vitest";
import { SHADER_PORTABILITY_INVENTORY } from "./shader-portability-inventory";

describe("shader portability inventory", () => {
  it("categorizes only the currently live first-pass WebGPU migration surfaces", () => {
    expect(SHADER_PORTABILITY_INVENTORY).toEqual({
      "fx-manager.ts": {
        strategy: "rewrite",
      },
      "hover-hex-material.ts": {
        strategy: "replace",
      },
      "resource-fx-manager.ts": {
        strategy: "replace",
      },
    });
  });
});
