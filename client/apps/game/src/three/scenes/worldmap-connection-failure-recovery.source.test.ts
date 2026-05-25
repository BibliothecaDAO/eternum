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
  it("clears map loading and invalidates outstanding fetches without scheduling an offline refresh", () => {
    const methodSource = extractRecoverAfterConnectionFailure(readSource("src/three/scenes/worldmap.tsx"));

    expect(methodSource).toContain("this.toriiLoadingCounter = 0");
    expect(methodSource).toContain("this.state.setLoading(LoadingStateKey.Map, false)");
    expect(methodSource).toContain("this.state.setLoading(LoadingStateKey.ChunkTransition, false)");
    expect(methodSource).toContain("clearStalledChunkAreaState");
    expect(methodSource).not.toContain("requestChunkRefresh");
  });

  it("clears all split hydration keys when recovering a stalled chunk", () => {
    const methodSource = extractClearStalledChunkAreaState(readSource("src/three/scenes/worldmap.tsx"));

    expect(methodSource).toContain("this.getRenderAreaKeyForChunk(chunkKey)");
    expect(methodSource).toContain("this.getStructuresRenderAreaKeyForChunk(chunkKey)");
    expect(methodSource).toContain("this.getExplorerTroopsRenderAreaKeyForChunk(chunkKey)");
    expect(methodSource).toContain("clearRenderAreaHydrationState(this.renderAreaHydrationState, areaKey)");
    expect(methodSource).toContain("clearRenderAreaHydrationState(this.renderAreaHydrationState, structuresAreaKey)");
    expect(methodSource).toContain(
      "clearRenderAreaHydrationState(this.renderAreaHydrationState, explorerTroopsAreaKey)",
    );
    expect(methodSource).not.toContain("explorerTroopsSpatialSqlBackoffUntilMs");
  });
});
