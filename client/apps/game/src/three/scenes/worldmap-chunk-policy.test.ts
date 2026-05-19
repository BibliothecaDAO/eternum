import { describe, expect, it } from "vitest";
import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";
import { getRenderAreaKeyForChunk } from "./worldmap-chunk-bounds";
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
    expect(policy).toHaveProperty(
      "toriiFetch.explorerTroopsSuperAreaStrides",
      WORLD_CHUNK_CONFIG.toriiFetch.explorerTroopsSuperAreaStrides,
    );
    expect(policy).toHaveProperty(
      "toriiFetch.structuresSuperAreaStrides",
      WORLD_CHUNK_CONFIG.toriiFetch.structuresSuperAreaStrides,
    );
    expect(policy.toriiFetch.explorerTroopsSuperAreaStrides).toBe(
      WORLD_CHUNK_CONFIG.toriiSubscription.superAreaStrides,
    );
    expect(policy.toriiFetch.structuresSuperAreaStrides).toBe(WORLD_CHUNK_CONFIG.toriiSubscription.superAreaStrides);
    expect(policy.toriiFetch.explorerTroopsSuperAreaStrides).toBeGreaterThan(policy.toriiFetch.superAreaStrides);
    expect(policy.toriiFetch.structuresSuperAreaStrides).toBeGreaterThan(policy.toriiFetch.superAreaStrides);
    expect(policy).toHaveProperty("toriiSubscription.superAreaStrides", 48);
    expect(policy.toriiSubscription.superAreaStrides).toBeGreaterThan(policy.toriiFetch.superAreaStrides);
    expect(policy).toHaveProperty("prefetch.forwardDepthStrides", WORLD_CHUNK_CONFIG.prefetch.forwardDepthStrides);
    expect(policy).toHaveProperty("prefetch.sideRadiusStrides", WORLD_CHUNK_CONFIG.prefetch.sideRadiusStrides);
    expect(policy).toHaveProperty("prefetch.areaBoundaryLookaheadStrides", 3);
    expect(policy).toHaveProperty("prefetch.maxConcurrent", WORLD_CHUNK_CONFIG.prefetch.maxConcurrent);
    expect(policy).toHaveProperty("recentHydrationCache.maxAreas", 48);
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

  it("coalesces sparse hydration across terrain hydration boundaries", () => {
    const policy = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);
    const firstChunkKey = "0,0";
    const nextTerrainAreaChunkKey = `${WORLD_CHUNK_CONFIG.stride * WORLD_CHUNK_CONFIG.toriiFetch.superAreaStrides},0`;

    const firstTerrainArea = getRenderAreaKeyForChunk(
      firstChunkKey,
      policy.chunkSize,
      policy.toriiFetch.superAreaStrides,
    );
    const nextTerrainArea = getRenderAreaKeyForChunk(
      nextTerrainAreaChunkKey,
      policy.chunkSize,
      policy.toriiFetch.superAreaStrides,
    );
    const firstExplorerTroopsArea = getRenderAreaKeyForChunk(
      firstChunkKey,
      policy.chunkSize,
      policy.toriiFetch.explorerTroopsSuperAreaStrides,
    );
    const nextExplorerTroopsArea = getRenderAreaKeyForChunk(
      nextTerrainAreaChunkKey,
      policy.chunkSize,
      policy.toriiFetch.explorerTroopsSuperAreaStrides,
    );
    const firstStructuresArea = getRenderAreaKeyForChunk(
      firstChunkKey,
      policy.chunkSize,
      policy.toriiFetch.structuresSuperAreaStrides,
    );
    const nextStructuresArea = getRenderAreaKeyForChunk(
      nextTerrainAreaChunkKey,
      policy.chunkSize,
      policy.toriiFetch.structuresSuperAreaStrides,
    );

    expect(firstTerrainArea).not.toBe(nextTerrainArea);
    expect(firstExplorerTroopsArea).toBe(nextExplorerTroopsArea);
    expect(firstStructuresArea).toBe(nextStructuresArea);
  });
});
