import { describe, expect, it } from "vitest";
import { getRendererOverlayPasses } from "./renderer-overlay-passes";

describe("renderer overlay passes", () => {
  it("returns overlay passes in stable declared order", () => {
    const overlayPasses = [
      { camera: { id: "world-camera" } as never, name: "interaction", scene: { id: "interaction-scene" } as never },
      { camera: { id: "hud-camera" } as never, name: "hud", scene: { id: "hud-scene" } as never },
    ];

    const result = getRendererOverlayPasses({
      mainCamera: { id: "main-camera" } as never,
      mainScene: { id: "main-scene" } as never,
      overlayPasses,
    });

    expect(result).toEqual(overlayPasses);
    expect(result).not.toBe(overlayPasses);
  });

  it("returns an empty list when no overlays are configured", () => {
    expect(
      getRendererOverlayPasses({
        mainCamera: { id: "main-camera" } as never,
        mainScene: { id: "main-scene" } as never,
      }),
    ).toEqual([]);
  });
});
