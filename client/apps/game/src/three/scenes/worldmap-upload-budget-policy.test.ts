import { describe, expect, it } from "vitest";

import {
  estimateWorldmapCachedReplayUploadBytes,
  estimateWorldmapColdBuildUploadBytes,
} from "./worldmap-upload-budget-policy";

describe("worldmap-upload-budget-policy", () => {
  it("treats cached replay as a smaller upload budget than a cold build for the same chunk", () => {
    const cachedReplay = estimateWorldmapCachedReplayUploadBytes({
      colorInstanceCount: 48,
      matrixInstanceCount: 48,
    });
    const coldBuild = estimateWorldmapColdBuildUploadBytes({
      colorInstanceCount: 48,
      matrixInstanceCount: 48,
    });

    expect(cachedReplay).toBeLessThan(coldBuild);
  });
});
