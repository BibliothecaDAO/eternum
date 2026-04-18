import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractMethod(source: string, signature: string, nextSignature: string): string {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  return source.slice(start, end);
}

describe("executeTileEntitiesFetch — hydration settle yield", () => {
  // Regression: after getMapFromToriiExact resolved, the finally block
  // immediately called settleTileHydrationFetch, flipping fetchSettled=true
  // before Recs could dispatch its Tile.onTileUpdate subscribers. Those
  // post-settle updates were then filtered out by
  // shouldTrackHydrationUpdateForFetch (returns false when fetchSettled),
  // so pendingCount never incremented and waitForTileHydrationIdle resolved
  // against a still-empty exploredTiles map. prepareTerrainChunk snapshotted
  // the empty map, produced a preparedTerrain with every biome count=0, and
  // cached it with expectedExploredTerrainInstances=0 — which passed the
  // fingerprint rejection gate forever. Result: armies/structures render
  // (their pipelines don't depend on exploredTiles) but biome hexes stay
  // missing until an explicit chunk refresh invalidates the cache.
  //
  // The fix yields one macrotask (setTimeout 0) before settling so queued
  // subscription callbacks have a chance to call updateExploredHex and
  // hence register against pendingCount via trackTileHydrationUpdate.
  it("yields to the event loop before marking fetch settled", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  private async executeTileEntitiesFetch(",
      "  private touchMatrixCache(",
    );

    const yieldIndex = methodSource.search(/await new Promise[^;]*setTimeout/);
    const settleTileIndex = methodSource.indexOf("this.settleTileHydrationFetch(");
    const settleStructureIndex = methodSource.indexOf("this.settleStructureHydrationFetch(");

    expect(yieldIndex).toBeGreaterThanOrEqual(0);
    expect(settleTileIndex).toBeGreaterThanOrEqual(0);
    expect(settleStructureIndex).toBeGreaterThanOrEqual(0);
    expect(yieldIndex).toBeLessThan(settleTileIndex);
    expect(yieldIndex).toBeLessThan(settleStructureIndex);
  });
});
