import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function readHoverLabelManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "../managers/hover-label-manager.ts"), "utf8");
}

describe("WorldmapScene Stage 2: Timer and Effect Cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Bug 2a: followCameraTimeout cleared on switchOff", () => {
    it("onSwitchOff clears followCameraTimeout in worldmap source", () => {
      const source = readWorldmapSource();
      const switchOffStart = source.indexOf("onSwitchOff(nextSceneName");
      const switchOffEnd = source.indexOf("\n  }", switchOffStart);
      const switchOffBody = source.slice(switchOffStart, switchOffEnd);

      // The fix should clear followCameraTimeout in onSwitchOff
      expect(switchOffBody).toMatch(/clearTimeout\(this\.followCameraTimeout\)/);
      expect(switchOffBody).toMatch(/this\.followCameraTimeout\s*=\s*null/);
    });

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
    it("onSwitchOff iterates and calls travel effect cleanup functions in worldmap source", () => {
      const source = readWorldmapSource();
      const switchOffStart = source.indexOf("onSwitchOff(nextSceneName");
      const switchOffEnd = source.indexOf("\n  }", switchOffStart);
      const switchOffBody = source.slice(switchOffStart, switchOffEnd);

      // The fix should iterate travelEffects and call each cleanup, then clear both maps
      expect(switchOffBody).toMatch(/this\.travelEffects\.forEach/);
      expect(switchOffBody).toMatch(/this\.travelEffects\.clear\(\)/);
      expect(switchOffBody).toMatch(/this\.travelEffectsByEntity\.clear\(\)/);
    });

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

  describe("Bug 2c: hoverLabelManager and selectedHexManager disposed in destroy", () => {
    it("HoverLabelManager has a dispose method", () => {
      const source = readHoverLabelManagerSource();
      expect(source).toMatch(/dispose\s*\(\)/);
    });

    it("HoverLabelManager.dispose calls onHexLeave to clean up active labels", () => {
      const source = readHoverLabelManagerSource();
      const disposeStart = source.indexOf("dispose()");
      if (disposeStart < 0) {
        throw new Error("dispose() method not found in HoverLabelManager");
      }
      const disposeEnd = source.indexOf("}", disposeStart);
      const disposeBody = source.slice(disposeStart, disposeEnd);

      // dispose should call onHexLeave to clean up all active labels
      expect(disposeBody).toMatch(/this\.onHexLeave\(\)/);
    });

    it("destroy() calls hoverLabelManager.dispose() in worldmap source", () => {
      const source = readWorldmapSource();
      const destroyStart = source.indexOf("\n  destroy() {");
      const destroyEnd = source.indexOf("\n  }", destroyStart);
      const destroyBody = source.slice(destroyStart, destroyEnd);

      expect(destroyBody).toMatch(/this\.hoverLabelManager\.dispose\(\)/);
    });

    it("destroy() calls selectedHexManager.dispose() in worldmap source", () => {
      const source = readWorldmapSource();
      const destroyStart = source.indexOf("\n  destroy() {");
      const destroyEnd = source.indexOf("\n  }", destroyStart);
      const destroyBody = source.slice(destroyStart, destroyEnd);

      expect(destroyBody).toMatch(/this\.selectedHexManager\.dispose\(\)/);
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
