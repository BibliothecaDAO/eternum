// @vitest-environment node
import { describe, expect, it } from "vitest";

import { GraphicsSettings, shouldRecommendInitialGraphicsSetting } from "./config";

describe("graphics settings bootstrap", () => {
  it("does not run device recommendation over an explicit graphics setting", () => {
    expect(shouldRecommendInitialGraphicsSetting(GraphicsSettings.HIGH, null)).toBe(false);
    expect(shouldRecommendInitialGraphicsSetting(GraphicsSettings.ULTRA_LOW, null)).toBe(false);
  });

  it("runs device recommendation only before any explicit graphics setting exists", () => {
    expect(shouldRecommendInitialGraphicsSetting(null, null)).toBe(true);
    expect(shouldRecommendInitialGraphicsSetting(null, "true")).toBe(false);
  });
});
