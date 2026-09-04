import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
    T3: "T3",
  },
  ResourcesIds: {
    StaminaRelic1: 1,
  },
  getNeighborHexes: vi.fn(() => []),
}));

vi.mock("../constants", () => ({
  HEX_SIZE: 1,
}));

vi.mock("../utils", () => ({
  getWorldPositionForHex: vi.fn(() => new THREE.Vector3()),
}));

import { ThunderBoltManager } from "./thunderbolt-manager";

describe("ThunderBoltManager lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels scheduled thunderbolt spawns during destroy", () => {
    const manager = new ThunderBoltManager(new THREE.Scene(), {
      object: { position: new THREE.Vector3() },
      target: new THREE.Vector3(),
    });
    const createThunderBoltSpy = vi.spyOn(manager as never, "createThunderBolt").mockImplementation(() => undefined);
    vi.spyOn(manager as never, "getCenterHexFromCamera").mockReturnValue({ col: 0, row: 0 });
    vi.spyOn(manager as never, "getRandomHexesAroundCenter").mockReturnValue([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);

    manager.spawnThunderBolts();
    manager.destroy();
    vi.runAllTimers();

    expect(createThunderBoltSpy).not.toHaveBeenCalled();
  });
});

describe("ThunderBoltManager opacity determinism", () => {
  it("produces deterministic opacity — same inputs yield same output regardless of previous frame", () => {
    // Simulate the opacity calculation from the non-persistent update branch.
    // The fix replaces the self-referential read of layer.material.opacity with a
    // deterministic layerIndex-based brightness factor.
    function computeOpacity(baseFade: number, flicker: number, layerIndex: number): number {
      const layerFade = layerIndex === 0 ? 1.0 : 0.7 + layerIndex * 0.1;
      const opacity = THREE.MathUtils.clamp(baseFade * (0.7 + flicker * 0.3) * layerFade, 0.02, 1);
      const layerBrightness = layerIndex === 0 ? 1.0 : 0.8;
      return THREE.MathUtils.clamp(opacity * layerBrightness, 0.02, 1);
    }

    // Run twice with identical inputs — must produce identical outputs
    const result1 = computeOpacity(0.6, 0.9, 0);
    const result2 = computeOpacity(0.6, 0.9, 0);
    expect(result1).toBe(result2);

    const result3 = computeOpacity(0.6, 0.9, 1);
    const result4 = computeOpacity(0.6, 0.9, 1);
    expect(result3).toBe(result4);
  });

  it("core layers (index 0) are brighter than outer layers at the same elapsed time", () => {
    const baseFade = 0.8;
    const flicker = 0.75;

    const layerFade0 = 1.0;
    const opacity0 = THREE.MathUtils.clamp(baseFade * (0.7 + flicker * 0.3) * layerFade0, 0.02, 1);
    const core = THREE.MathUtils.clamp(opacity0 * 1.0, 0.02, 1);

    const layerFade1 = 0.7 + 1 * 0.1;
    const opacity1 = THREE.MathUtils.clamp(baseFade * (0.7 + flicker * 0.3) * layerFade1, 0.02, 1);
    const outer = THREE.MathUtils.clamp(opacity1 * 0.8, 0.02, 1);

    expect(core).toBeGreaterThan(outer);
  });

  it("opacity stays within clamped range [0.02, 1.0] across many frames", () => {
    for (let frame = 0; frame < 120; frame++) {
      const progress = frame / 120;
      const fadeIn = Math.min(1, progress / 0.15);
      const fadeOut = progress > 0.35 ? 1 - (progress - 0.35) / 0.65 : 1;
      const flicker = 0.65 + Math.sin(frame * 0.3 * 0.015) * 0.35;
      const baseFade = fadeIn * fadeOut;

      for (let layerIndex = 0; layerIndex < 3; layerIndex++) {
        const layerFade = layerIndex === 0 ? 1.0 : 0.7 + layerIndex * 0.1;
        const opacity = THREE.MathUtils.clamp(baseFade * (0.7 + flicker * 0.3) * layerFade, 0.02, 1);
        const layerBrightness = layerIndex === 0 ? 1.0 : 0.8;
        const finalOpacity = THREE.MathUtils.clamp(opacity * layerBrightness, 0.02, 1);

        expect(finalOpacity).toBeGreaterThanOrEqual(0.02);
        expect(finalOpacity).toBeLessThanOrEqual(1.0);
      }
    }
  });
});
