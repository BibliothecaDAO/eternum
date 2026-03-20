import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractUpdateExploredHexMethod(source: string): string {
  const start = source.indexOf("  public async updateExploredHex(update: TileSystemUpdate) {");
  const end = source.indexOf("  isColRowInVisibleChunk(col: number, row: number) {", start);
  return source.slice(start, end);
}

describe("worldmap live append transition guard", () => {
  it("marks same-chunk refreshes as chunk transitions while refreshCurrentChunk is in flight", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(
      /if \(chunkDecision\.action === "refresh_current_chunk"\) \{[\s\S]*?this\.isChunkTransitioning = true;[\s\S]*?this\.globalChunkSwitchPromise = this\.refreshCurrentChunk\(chunkKey, startCol, startRow, transitionToken\);[\s\S]*?this\.globalChunkSwitchPromise = null;[\s\S]*?this\.isChunkTransitioning = false;/s,
    );
  });

  it("skips live biome mesh appends while a chunk transition is in flight", () => {
    const methodSource = extractUpdateExploredHexMethod(readWorldmapSource());

    expect(methodSource).toMatch(
      /if \(visibleTerrainReconcileMode === "atomic_chunk_refresh"\) \{[\s\S]*?this\.requestChunkRefresh\(true, "tile_overlap_repair"\);[\s\S]*?return;[\s\S]*?if \(this\.isChunkTransitioning\) \{[\s\S]*?this\.requestChunkRefresh\(true, "deferred_transition_tile"\);[\s\S]*?return;[\s\S]*?this\.interactiveHexManager\.addHex/s,
    );
  });

  it("keeps direct instance buffer writes behind the transition guard", () => {
    const methodSource = extractUpdateExploredHexMethod(readWorldmapSource());
    const guardIndex = methodSource.indexOf('this.requestChunkRefresh(true, "deferred_transition_tile");');
    const setMatrixIndex = methodSource.indexOf("hexMesh.setMatrixAt(currentCount, dummy.matrix);");
    const setCountIndex = methodSource.indexOf("hexMesh.setCount(currentCount + 1);");

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(setMatrixIndex).toBeGreaterThan(guardIndex);
    expect(setCountIndex).toBeGreaterThan(guardIndex);
  });
});
