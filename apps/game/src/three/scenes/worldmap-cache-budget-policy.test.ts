import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WORLD_CHUNK_CONFIG } from "../constants/world-chunk-config";
import { createWorldmapChunkPolicy } from "./worldmap-chunk-policy";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap cache budget policy", () => {
  it("drives worldmap matrix cache capacity from policy recommended minimum", () => {
    const worldmapSource = readWorldmapSource();
    expect(worldmapSource).toMatch(/maxMatrixCacheSize\s*=\s*WORLDMAP_CHUNK_POLICY\.cache\.recommendedMinSize/);
  });

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

  it("avoids direct WORLD_CHUNK_CONFIG field reads inside worldmap runtime", () => {
    const worldmapSource = readWorldmapSource();
    const directConfigReadMatches = [...worldmapSource.matchAll(/WORLD_CHUNK_CONFIG\./g)];
    expect(directConfigReadMatches).toHaveLength(0);
  });
});
