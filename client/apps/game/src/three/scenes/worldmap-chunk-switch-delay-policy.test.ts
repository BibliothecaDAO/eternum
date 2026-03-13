import { describe, expect, it } from "vitest";
import { shouldDelayWorldmapChunkSwitch } from "./worldmap-chunk-switch-delay-policy";

describe("shouldDelayWorldmapChunkSwitch", () => {
  const baseInput = {
    cameraPosition: { x: 100, z: 100 },
    lastChunkSwitchPosition: { x: 95, z: 96 },
    chunkSize: 24,
    hexSize: 1,
    chunkSwitchPadding: 0.25,
  };

  it("does not delay when chunk switch anchor is missing", () => {
    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: false,
      }),
    ).toBe(false);
  });

  it("does not delay when last chunk switch position is unavailable", () => {
    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: true,
        lastChunkSwitchPosition: undefined,
      }),
    ).toBe(false);
  });

  it("delays when camera remains inside padding bounds on both axes", () => {
    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: true,
      }),
    ).toBe(true);
  });

  it("does not delay when camera reaches the exact x-threshold", () => {
    const chunkWorldWidth = baseInput.chunkSize * baseInput.hexSize * Math.sqrt(3);
    const xThreshold = baseInput.lastChunkSwitchPosition.x + chunkWorldWidth * baseInput.chunkSwitchPadding;

    expect(
      shouldDelayWorldmapChunkSwitch({
        ...baseInput,
        hasChunkSwitchAnchor: true,
        cameraPosition: { x: xThreshold, z: baseInput.cameraPosition.z },
      }),
    ).toBe(false);
  });
});
