import { describe, expect, it } from "vitest";
import { resolveWorldmapShadowMapSize, shouldCastWorldmapDirectionalShadow } from "./worldmap-shadow-policy";

describe("shouldCastWorldmapDirectionalShadow", () => {
  it("disables shadows in far view", () => {
    expect(shouldCastWorldmapDirectionalShadow(true, true)).toBe(false);
  });

  it("disables shadows when quality disables them", () => {
    expect(shouldCastWorldmapDirectionalShadow(false, false)).toBe(false);
  });

  it("enables shadows for non-far view when quality allows", () => {
    expect(shouldCastWorldmapDirectionalShadow(true, false)).toBe(true);
  });

  it("preserves the quality-selected shadow map size", () => {
    expect(resolveWorldmapShadowMapSize(2048)).toBe(2048);
    expect(resolveWorldmapShadowMapSize(1024)).toBe(1024);
  });
});
