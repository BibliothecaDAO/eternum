import { describe, expect, it } from "vitest";
import { syncRenderPassScene } from "./renderer-pass-scene";

describe("syncRenderPassScene", () => {
  it("updates both scene and mainScene when the pass exposes both", () => {
    const nextScene = { id: "next-scene" };
    const pass = {
      scene: { id: "old-scene" },
      mainScene: { id: "old-main-scene" },
    };

    syncRenderPassScene(pass, nextScene as never);

    expect(pass.scene).toBe(nextScene);
    expect(pass.mainScene).toBe(nextScene);
  });

  it("still updates scene-only passes", () => {
    const nextScene = { id: "next-scene" };
    const pass = {
      scene: { id: "old-scene" },
    };

    syncRenderPassScene(pass, nextScene as never);

    expect(pass.scene).toBe(nextScene);
  });
});
