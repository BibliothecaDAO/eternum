import { describe, expect, it } from "vitest";
import { resolvePointLabelTextureFlipY } from "./point-label-texture-policy";

describe("resolvePointLabelTextureFlipY", () => {
  it("keeps point-label icons upright in legacy webgl by leaving flipY enabled", () => {
    expect(resolvePointLabelTextureFlipY("legacy-webgl")).toBe(true);
  });

  it("preserves the flipped texture upload path for webgpu-compatible renderers", () => {
    expect(resolvePointLabelTextureFlipY("webgpu")).toBe(false);
    expect(resolvePointLabelTextureFlipY("webgl2-fallback")).toBe(false);
    expect(resolvePointLabelTextureFlipY(null)).toBe(false);
  });
});
