import { describe, expect, it } from "vitest";

import { resolveRendererTargetPixelRatio } from "./renderer-display-runtime";

describe("the renderer's pixel ratio", () => {
  it("follows a page zoomed out below one, so it never draws more pixels than the screen has", () => {
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 0.33 })).toBe(0.33);
  });

  it("is capped on a retina screen", () => {
    expect(resolveRendererTargetPixelRatio({ devicePixelRatio: 2 })).toBe(1.25);
  });
});
