import { describe, expect, it } from "vitest";

import { resolveWorldmapStrategicVisualPolicy } from "./worldmap-strategic-visual-policy";

describe("resolveWorldmapStrategicVisualPolicy", () => {
  it("keeps three-dimensional mode fully interactive while gently simplifying far zoom", () => {
    const policy = resolveWorldmapStrategicVisualPolicy({
      mode: "three_d",
      transitionProgress: 0,
      zoomLevel: 0.65,
    });

    expect(policy.overlayOpacity).toBe(0);
    expect(policy.strategicLayerPointerEvents).toBe(false);
    expect(policy.suppressWorldInteractions).toBe(false);
    expect(policy.worldTerrainContrast).toBeLessThan(1);
    expect(policy.worldTerrainSaturation).toBeLessThan(1);
    expect(policy.worldGridOpacity).toBeLessThanOrEqual(0.1);
  });

  it("makes the transition band read as flattening instead of a late overlay pop", () => {
    const policy = resolveWorldmapStrategicVisualPolicy({
      mode: "transition",
      transitionProgress: 0.5,
      zoomLevel: 0.8,
    });

    expect(policy.overlayOpacity).toBeGreaterThan(0.5);
    expect(policy.worldGridOpacity).toBeLessThan(0.08);
    expect(policy.strategicSurfaceOpacity).toBeGreaterThan(0.6);
    expect(policy.strategicMarkerOpacity).toBeGreaterThan(0.3);
    expect(policy.disableDirectionalShadows).toBe(true);
  });

  it("fully promotes the cartographic layer in strategic mode", () => {
    const policy = resolveWorldmapStrategicVisualPolicy({
      mode: "strategic_2d",
      transitionProgress: 1,
      zoomLevel: 1,
    });

    expect(policy.overlayOpacity).toBe(1);
    expect(policy.strategicLayerPointerEvents).toBe(true);
    expect(policy.worldEntityOpacity).toBeLessThan(0.4);
    expect(policy.strategicSurfaceOpacity).toBeGreaterThan(0.9);
    expect(policy.selectionRingOpacity).toBe(1);
  });
});
