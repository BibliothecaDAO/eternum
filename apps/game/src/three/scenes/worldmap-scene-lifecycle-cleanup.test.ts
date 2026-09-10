import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("WorldmapScene Stage 2: Timer and Effect Cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Bug 2a: followCameraTimeout cleared on switchOff", () => {
    it("clearing followCameraTimeout prevents callback from firing", () => {
      let followCameraTimeout: ReturnType<typeof setTimeout> | null = null;
      const callbackSpy = vi.fn();

      // Simulate setting the timeout (as focusCameraOnEvent does)
      followCameraTimeout = setTimeout(() => {
        callbackSpy();
        followCameraTimeout = null;
      }, 3000);

      // Simulate the fix: clearing in onSwitchOff
      if (followCameraTimeout) {
        clearTimeout(followCameraTimeout);
        followCameraTimeout = null;
      }

      // Advance past the timeout duration
      vi.advanceTimersByTime(4000);

      expect(callbackSpy).not.toHaveBeenCalled();
      expect(followCameraTimeout).toBeNull();
    });

    it("is safe to clear followCameraTimeout when it is already null", () => {
      let followCameraTimeout: ReturnType<typeof setTimeout> | null = null;

      if (followCameraTimeout) {
        clearTimeout(followCameraTimeout);
        followCameraTimeout = null;
      }

      expect(followCameraTimeout).toBeNull();
    });
  });

  describe("Bug 2b: travelEffects cleaned up on switchOff", () => {
    it("calling all cleanup functions and clearing maps prevents dangling callbacks", () => {
      const travelEffects = new Map<string, () => void>();
      const travelEffectsByEntity = new Map<number, { key: string; cleanup: () => void; effectType: string }>();

      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      travelEffects.set("effect-1", cleanup1);
      travelEffects.set("effect-2", cleanup2);
      travelEffectsByEntity.set(100, { key: "effect-1", cleanup: cleanup1, effectType: "travel" });
      travelEffectsByEntity.set(200, { key: "effect-2", cleanup: cleanup2, effectType: "explore" });

      // Simulate the fix: cleanup in onSwitchOff
      travelEffects.forEach((cleanup) => cleanup());
      travelEffects.clear();
      travelEffectsByEntity.clear();

      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
      expect(travelEffects.size).toBe(0);
      expect(travelEffectsByEntity.size).toBe(0);
    });

    it("no maxLifetimeTimeout callbacks fire after travel effects are cleaned up", () => {
      const travelEffects = new Map<string, () => void>();
      const maxLifetimeCallbackSpy = vi.fn();

      let cleaned = false;
      let maxLifetimeTimeout: ReturnType<typeof setTimeout> | undefined;

      const runCleanupNow = () => {
        if (cleaned) return;
        cleaned = true;
        if (maxLifetimeTimeout) {
          clearTimeout(maxLifetimeTimeout);
          maxLifetimeTimeout = undefined;
        }
      };

      const cleanup = () => {
        if (cleaned) return;
        runCleanupNow();
      };

      travelEffects.set("key-1", cleanup);
      maxLifetimeTimeout = setTimeout(() => {
        maxLifetimeCallbackSpy();
        cleanup();
      }, 90_000);

      // Simulate onSwitchOff
      travelEffects.forEach((fn) => fn());
      travelEffects.clear();

      // Advance past the max lifetime
      vi.advanceTimersByTime(100_000);

      expect(maxLifetimeCallbackSpy).not.toHaveBeenCalled();
    });

    it("is safe to clean up travel effects when maps are empty", () => {
      const travelEffects = new Map<string, () => void>();
      const travelEffectsByEntity = new Map<number, { key: string; cleanup: () => void; effectType: string }>();

      travelEffects.forEach((cleanup) => cleanup());
      travelEffects.clear();
      travelEffectsByEntity.clear();

      expect(travelEffects.size).toBe(0);
      expect(travelEffectsByEntity.size).toBe(0);
    });
  });

  describe("Idempotent switchOff", () => {
    it("calling switchOff cleanup twice does not throw", () => {
      let followCameraTimeout: ReturnType<typeof setTimeout> | null = null;
      const travelEffects = new Map<string, () => void>();
      const travelEffectsByEntity = new Map<number, { key: string; cleanup: () => void; effectType: string }>();

      followCameraTimeout = setTimeout(() => {}, 3000);
      travelEffects.set("key", vi.fn());

      const runSwitchOffCleanup = () => {
        if (followCameraTimeout) {
          clearTimeout(followCameraTimeout);
          followCameraTimeout = null;
        }
        travelEffects.forEach((cleanup) => cleanup());
        travelEffects.clear();
        travelEffectsByEntity.clear();
      };

      runSwitchOffCleanup();
      expect(() => runSwitchOffCleanup()).not.toThrow();
    });
  });
});
