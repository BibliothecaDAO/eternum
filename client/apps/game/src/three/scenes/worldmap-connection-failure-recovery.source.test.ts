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

describe("worldmap connection failure recovery", () => {
  it("clears map loading and invalidates outstanding fetches without scheduling an offline refresh", () => {
    const methodSource = extractRecoverAfterConnectionFailure(readSource("src/three/scenes/worldmap.tsx"));

    expect(methodSource).toContain("this.toriiLoadingCounter = 0");
    expect(methodSource).toContain("this.state.setLoading(LoadingStateKey.Map, false)");
    expect(methodSource).toContain("this.state.setLoading(LoadingStateKey.ChunkTransition, false)");
    expect(methodSource).toContain("clearStalledChunkAreaState");
    expect(methodSource).not.toContain("requestChunkRefresh");
  });
});
