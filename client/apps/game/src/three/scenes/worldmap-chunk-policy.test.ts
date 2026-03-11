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

  it("exposes complete torii and directional prefetch fields from one policy contract", () => {
    const policy = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);

    expect(policy).toHaveProperty("toriiFetch.superAreaStrides", WORLD_CHUNK_CONFIG.toriiFetch.superAreaStrides);
    expect(policy).toHaveProperty("prefetch.forwardDepthStrides", WORLD_CHUNK_CONFIG.prefetch.forwardDepthStrides);
    expect(policy).toHaveProperty("prefetch.sideRadiusStrides", WORLD_CHUNK_CONFIG.prefetch.sideRadiusStrides);
    expect(policy).toHaveProperty("prefetch.maxConcurrent", WORLD_CHUNK_CONFIG.prefetch.maxConcurrent);
  });

  it("derives pinned neighborhood floor metadata for cache budgeting", () => {
    const policy = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);
    const pinnedChunkFloor = (WORLD_CHUNK_CONFIG.pinRadius * 2 + 1) ** 2;

    expect(policy).toHaveProperty("cache.pinnedChunkFloor", pinnedChunkFloor);
    expect(policy).toHaveProperty("cache.slack");
    expect((policy as { cache?: { slack?: number } }).cache?.slack).toBeGreaterThan(0);
    expect(policy).toHaveProperty("cache.recommendedMinSize");
    expect((policy as { cache?: { recommendedMinSize?: number; slack?: number } }).cache?.recommendedMinSize).toBe(
      pinnedChunkFloor + ((policy as { cache?: { slack?: number } }).cache?.slack ?? 0),
    );
    expect((policy as { cache?: { recommendedMinSize?: number } }).cache?.recommendedMinSize).toBeGreaterThanOrEqual(
      pinnedChunkFloor,
    );
  });
});
