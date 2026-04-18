import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("tile onTileUpdate — hydration tracking uses synchronous signal", () => {
  // Regression: previously the subscription called
  //   trackTileHydrationUpdate(value, updateExploredHex(value))
  // passing updateExploredHex's full promise as the "work" to wait on. That
  // promise awaits modelLoadPromises / updateHexagonGrid inside its body — on
  // cold load those can stall for 10+ seconds while biome GLTFs finish
  // downloading, which pins pendingCount > 0 and blocks
  // waitForTileHydrationIdle indefinitely. prepareTerrainChunk never runs for
  // the first chunk and biomes stay missing until a later refresh regenerates
  // the scene (observed in live traces: gen 0 enter at t=266s with cols=0,
  // gen 1 scheduled-refresh finalize at t=279s with 144 instances + 16 biomes
  // — the ~13s gap is the stalled gen 0 wait).
  //
  // Fix: updateExploredHex's synchronous prelude lands the tile in
  // exploredTiles before any await, so by the time the call returns the
  // hydration data is already in place. Pass Promise.resolve() to the
  // tracker so pendingCount drops on the next microtask instead of being
  // coupled to downstream render-pipeline awaits.
  it("fires updateExploredHex before trackTileHydrationUpdate with Promise.resolve", () => {
    const source = readWorldmapSource();
    const methodStart = source.indexOf("private registerTileWorldUpdateSubscriptions(");
    const methodEnd = source.indexOf("private ", methodStart + 1);
    const methodSource = source.slice(methodStart, methodEnd);

    const updateIndex = methodSource.indexOf("void this.updateExploredHex(value);");
    const trackIndex = methodSource.indexOf("void this.trackTileHydrationUpdate(value, Promise.resolve());");

    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(trackIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeLessThan(trackIndex);
  });

  it("does not pass updateExploredHex's promise into trackTileHydrationUpdate", () => {
    const source = readWorldmapSource();
    const methodStart = source.indexOf("private registerTileWorldUpdateSubscriptions(");
    const methodEnd = source.indexOf("private ", methodStart + 1);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(methodSource).not.toMatch(/trackTileHydrationUpdate\(\s*value\s*,\s*this\.updateExploredHex\(/);
  });
});
