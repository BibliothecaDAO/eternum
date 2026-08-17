import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap biome overlay race hardening", () => {
  it("syncs projection tiles before chunk presentation", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/syncProjectionTiles:\s*\(targetChunkKey\)\s*=>\s*this\.syncProjectionTilesForChunk/);
    expect(source).not.toContain("waitForTileHydrationIdle");
  });

  it("fences live tile page rebuilds instead of appending into composed terrain", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/subscribeTiles/);
    expect(source).toMatch(/visualTerrainPageRevisions/);
    expect(source).toMatch(/buildAndApplyVisualTerrainPage/);
    expect(source).not.toMatch(/terrainVisibleAppendCount/);
  });

  it("checks terrain fingerprint before cache replay is accepted", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/createWorldmapTerrainFingerprint/);
    expect(source).toMatch(/shouldRejectCachedTerrainFingerprintMismatch/);
  });
});
