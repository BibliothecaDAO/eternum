import { describe, expect, it } from "vitest";
import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";
import { createWorldmapChunkPolicy } from "./worldmap-chunk-policy";

describe("worldmap cache budget policy", () => {
  it("keeps recommended minimum cache capacity at or above pinned neighborhood floor", () => {
    const pinnedChunkFloor = (WORLD_CHUNK_CONFIG.pinRadius * 2 + 1) ** 2;
    const policy = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);

    expect(policy.cache.recommendedMinSize).toBeGreaterThanOrEqual(pinnedChunkFloor);
  });

  it("exposes explicit cache slack guidance from chunk policy", () => {
    const policy = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);
    const pinnedChunkFloor = (WORLD_CHUNK_CONFIG.pinRadius * 2 + 1) ** 2;

    expect(policy).toHaveProperty("cache.pinnedChunkFloor", pinnedChunkFloor);
    expect(policy).toHaveProperty("cache.slack");
    expect(policy.cache.slack).toBeGreaterThan(0);
    expect(policy).toHaveProperty("cache.recommendedMinSize");
    expect(policy.cache.recommendedMinSize).toBe(pinnedChunkFloor + policy.cache.slack);
  });
});
