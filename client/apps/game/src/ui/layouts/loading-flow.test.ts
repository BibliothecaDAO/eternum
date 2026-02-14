import { describe, expect, it } from "vitest";

import {
  resolveOnboardingPhaseForScreen,
  shouldRenderOnboardingScreen,
  shouldShowTransitionLoadingOverlay,
} from "./loading-flow";

describe("loading-flow", () => {
  describe("shouldRenderOnboardingScreen", () => {
    it("returns true for direct onboarding phases", () => {
      expect(shouldRenderOnboardingScreen("world-select", true, true)).toBe(true);
      expect(shouldRenderOnboardingScreen("account", true, true)).toBe(true);
      expect(shouldRenderOnboardingScreen("loading", true, true)).toBe(true);
    });

    it("returns true when setup or account is not ready", () => {
      expect(shouldRenderOnboardingScreen("settlement", false, true)).toBe(true);
      expect(shouldRenderOnboardingScreen("settlement", true, false)).toBe(true);
      expect(shouldRenderOnboardingScreen("ready", false, false)).toBe(true);
    });

    it("returns false when setup and account are ready outside onboarding phases", () => {
      expect(shouldRenderOnboardingScreen("settlement", true, true)).toBe(false);
      expect(shouldRenderOnboardingScreen("ready", true, true)).toBe(false);
    });
  });

  describe("resolveOnboardingPhaseForScreen", () => {
    it("preserves explicit onboarding phases", () => {
      expect(resolveOnboardingPhaseForScreen("world-select", true, true)).toBe("world-select");
      expect(resolveOnboardingPhaseForScreen("account", true, true)).toBe("account");
      expect(resolveOnboardingPhaseForScreen("loading", true, true)).toBe("loading");
    });

    it("bridges non-onboarding phases to loading while dependencies are not ready", () => {
      expect(resolveOnboardingPhaseForScreen("settlement", false, true)).toBe("loading");
      expect(resolveOnboardingPhaseForScreen("ready", true, false)).toBe("loading");
    });
  });

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
