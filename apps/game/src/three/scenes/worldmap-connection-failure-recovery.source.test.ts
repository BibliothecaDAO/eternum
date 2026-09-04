// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractRecoverAfterConnectionFailure = (source: string): string => {
  const start = source.indexOf("  private recoverAfterConnectionFailure");
  const end = source.indexOf("  private refreshAfterReconnect", start);
  return source.slice(start, end);
};

const extractClearStalledChunkAreaState = (source: string): string => {
  const start = source.indexOf("  private clearStalledChunkAreaState");
  const end = source.indexOf("  private recoverChunkStreamingAfterStall", start);
  return source.slice(start, end);
};

describe("worldmap connection failure recovery", () => {
  it("clears transition loading and invalidates outstanding fetches without scheduling an offline refresh", () => {
    const methodSource = extractRecoverAfterConnectionFailure(readSource("src/three/scenes/worldmap.tsx"));

    expect(methodSource).toContain("this.state.setLoading(LoadingStateKey.ChunkTransition, false)");
    expect(methodSource).toContain("clearStalledChunkAreaState");
    expect(methodSource).not.toContain("requestChunkRefresh");
  });

  it("clears stale refresh bookkeeping without projection or fetch state", () => {
    const methodSource = extractClearStalledChunkAreaState(readSource("src/three/scenes/worldmap.tsx"));

    expect(methodSource).toContain("this.getRenderAreaKeyForChunk(chunkKey)");
    expect(methodSource).toContain("this.hydratedRefreshSuppressionAreaKeys.delete(areaKey)");
    expect(methodSource).not.toContain("renderAreaHydrationState");
    expect(methodSource).not.toContain("pendingChunkFetchGeneration");
    expect(methodSource).not.toContain("explorerTroops");
    expect(methodSource).not.toContain("structuresAreaKey");
  });
});
