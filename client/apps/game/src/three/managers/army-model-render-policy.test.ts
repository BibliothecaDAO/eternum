import { describe, expect, it } from "vitest";
import { resolveRenderableBaseModel } from "./army-model-render-policy";

describe("resolveRenderableBaseModel", () => {
  it("keeps previous renderable model while desired model is still loading", () => {
    const resolved = resolveRenderableBaseModel({
      hasActiveCosmetic: false,
      desiredModel: "Boat",
      previousRenderableModel: "Knight",
      isDesiredModelLoaded: false,
      isPreviousModelLoaded: true,
    });

    expect(resolved).toBe("Knight");
  });

  it("switches to desired model once it is loaded", () => {
    const resolved = resolveRenderableBaseModel({
      hasActiveCosmetic: false,
      desiredModel: "Boat",
      previousRenderableModel: "Knight",
      isDesiredModelLoaded: true,
      isPreviousModelLoaded: true,
    });

    expect(resolved).toBe("Boat");
  });

  it("clears base model when cosmetic is active", () => {
    const resolved = resolveRenderableBaseModel({
      hasActiveCosmetic: true,
      desiredModel: "Boat",
      previousRenderableModel: "Knight",
      isDesiredModelLoaded: true,
      isPreviousModelLoaded: true,
    });

    expect(resolved).toBeNull();
  });
});
