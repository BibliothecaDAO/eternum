import { describe, expect, it } from "vitest";

import {
  classifyWorldmapUploadWork,
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

  it("classifies presentation prewarm separately from visible commit work", () => {
    const prewarm = classifyWorldmapUploadWork({
      colorInstanceCount: 48,
      matrixInstanceCount: 48,
      isCachedReplay: true,
      stage: "presentation_prewarm",
    });
    const visibleCommit = classifyWorldmapUploadWork({
      colorInstanceCount: 48,
      matrixInstanceCount: 48,
      isCachedReplay: true,
      stage: "visible_commit",
    });

    expect(prewarm.stage).toBe("presentation_prewarm");
    expect(visibleCommit.stage).toBe("visible_commit");
    expect(prewarm.estimatedUploadBytes).toBe(visibleCommit.estimatedUploadBytes);
  });
});
