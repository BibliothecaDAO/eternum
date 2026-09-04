import { describe, expect, it } from "vitest";

import { shouldShowTransitionLoadingOverlay } from "./loading-flow";

describe("loading-flow", () => {
  describe("shouldShowTransitionLoadingOverlay", () => {
    it("hides transition overlay while blank onboarding overlay is visible", () => {
      expect(shouldShowTransitionLoadingOverlay(true, true)).toBe(false);
    });

    it("shows transition overlay only when enabled and onboarding overlay is hidden", () => {
      expect(shouldShowTransitionLoadingOverlay(false, true)).toBe(true);
      expect(shouldShowTransitionLoadingOverlay(false, false)).toBe(false);
    });
  });
});
