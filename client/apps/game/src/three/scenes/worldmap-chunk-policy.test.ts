import { describe, expect, it } from "vitest";
import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";
import { createWorldmapChunkPolicy } from "./worldmap-chunk-policy";

describe("createWorldmapChunkPolicy", () => {
  it("derives worldmap policy from shared chunk config", () => {
    const policy = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);

    expect(policy.chunkSize).toBe(WORLD_CHUNK_CONFIG.stride);
    expect(policy.renderSize).toEqual(WORLD_CHUNK_CONFIG.renderSize);
    expect(policy.switchPadding).toBe(WORLD_CHUNK_CONFIG.switchPadding);
    expect(policy.pin.rowsAhead).toBe(WORLD_CHUNK_CONFIG.pinRadius);
    expect(policy.pin.rowsBehind).toBe(WORLD_CHUNK_CONFIG.pinRadius);
    expect(policy.pin.colsEachSide).toBe(WORLD_CHUNK_CONFIG.pinRadius);
    expect(policy.prefetch.maxAhead).toBe(WORLD_CHUNK_CONFIG.prefetch.maxAhead);
  });
});
