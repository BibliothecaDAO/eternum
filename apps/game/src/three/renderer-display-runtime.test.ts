import { describe, expect, it } from "vitest";

import { resolveRendererTargetPixelRatio } from "./renderer-display-runtime";

describe("the renderer's pixel ratio", () => {
  it("follows a page zoomed out below one, so it never draws more pixels than the screen has", () => {
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 0.33, cap: 1.25 })).toBe(0.33);
  });

  it("stops at the quality's cap on a retina screen", () => {
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 2, cap: 1.25 })).toBe(1.25);
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 3, cap: 2 })).toBe(2);
  });
});
