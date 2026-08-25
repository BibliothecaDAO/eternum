import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { solveWorldmapZoomAnchor } from "./worldmap-zoom-anchor-solver";

describe("solveWorldmapZoomAnchor", () => {
  it("zooms in around a world anchor while preserving the requested distance", () => {
    const result = solveWorldmapZoomAnchor({
      cameraPosition: new Vector3(0, 10, 10),
      target: new Vector3(0, 0, 0),
      anchorWorldPoint: new Vector3(5, 0, 0),
      nextDistance: 10,
    });

    expect(result.didUseAnchor).toBe(true);
    expect(result.cameraPosition.distanceTo(result.target)).toBeCloseTo(10, 5);
    expect(result.target.x).toBeGreaterThan(0);
  });

  it("zooms out around a world anchor while preserving the requested distance", () => {
    const result = solveWorldmapZoomAnchor({
      cameraPosition: new Vector3(2, 6, 6),
      target: new Vector3(2, 0, 0),
      anchorWorldPoint: new Vector3(-3, 0, 0),
      nextDistance: 14,
    });

    expect(result.didUseAnchor).toBe(true);
    expect(result.cameraPosition.distanceTo(result.target)).toBeCloseTo(14, 5);
    expect(result.target.x).toBeGreaterThan(2);
  });

  it("falls back to the current target when no anchor is available", () => {
    const result = solveWorldmapZoomAnchor({
      cameraPosition: new Vector3(0, 10, 10),
      target: new Vector3(0, 0, 0),
      anchorWorldPoint: null,
      nextDistance: 12,
    });

    expect(result.didUseAnchor).toBe(false);
    expect(result.target.toArray()).toEqual([0, 0, 0]);
    expect(result.cameraPosition.distanceTo(result.target)).toBeCloseTo(12, 5);
  });

  it("clamps the next target within navigation bounds", () => {
    const result = solveWorldmapZoomAnchor({
      cameraPosition: new Vector3(0, 10, 10),
      target: new Vector3(0, 0, 0),
      anchorWorldPoint: new Vector3(30, 0, 0),
      nextDistance: 8,
      navigationBounds: {
        minX: -5,
        maxX: 5,
        minZ: -5,
        maxZ: 5,
      },
    });

    expect(result.target.x).toBe(5);
    expect(result.target.z).toBeGreaterThanOrEqual(-5);
    expect(result.target.z).toBeLessThanOrEqual(5);
  });
});
