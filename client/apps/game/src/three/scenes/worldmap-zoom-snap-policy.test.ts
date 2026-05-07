import { describe, expect, it } from "vitest";
import { shouldSnapWorldmapZoomBandChange } from "./worldmap-zoom-snap-policy";

describe("worldmap zoom snap policy", () => {
  it("snaps fixed-band zoom only for native WebGPU", () => {
    expect(shouldSnapWorldmapZoomBandChange({ activeMode: "webgpu" })).toBe(true);
    expect(shouldSnapWorldmapZoomBandChange({ activeMode: "legacy-webgl" })).toBe(false);
    expect(shouldSnapWorldmapZoomBandChange({ activeMode: "webgl2-fallback" })).toBe(false);
    expect(shouldSnapWorldmapZoomBandChange({ activeMode: null })).toBe(false);
  });
});
