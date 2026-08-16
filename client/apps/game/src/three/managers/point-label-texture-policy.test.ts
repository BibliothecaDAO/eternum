import { describe, expect, it } from "vitest";
import { resolvePointLabelTextureFlipY } from "./point-label-texture-policy";

describe("resolvePointLabelTextureFlipY", () => {
  it("uses the WebGPU-compatible texture upload path for both backends", () => {
    expect(resolvePointLabelTextureFlipY("webgpu")).toBe(false);
    expect(resolvePointLabelTextureFlipY("webgl2-fallback")).toBe(false);
    expect(resolvePointLabelTextureFlipY(null)).toBe(false);
  });
});
