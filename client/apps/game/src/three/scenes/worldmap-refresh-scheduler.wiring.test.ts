import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap refresh scheduler wiring", () => {
  it("routes bursty force-refresh hot paths through requestChunkRefresh with reasons", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/requestChunkRefresh\(true,\s*"visibility_recovery"\)/);
    expect(source).toMatch(/requestChunkRefresh\(true,\s*"hydrated_chunk"\)/);
    expect(source).toMatch(/requestChunkRefresh\(true,\s*"offscreen_chunk"\)/);
    expect(source).toMatch(/requestChunkRefresh\(true,\s*"terrain_self_heal"\)/);
  });

  it("stops using direct force refreshes in the known hot paths", () => {
    const source = readWorldmapSource();
    const directForceRefreshCalls = source.match(/updateVisibleChunks\(true\)/g) ?? [];

    expect(directForceRefreshCalls).toHaveLength(0);
    expect(source).toMatch(
      /await this\.updateVisibleChunks\(true,\s*\{\s*reason: "shortcut",\s*triggerReason: "army_shortcut_selection_fallback",\s*\}\)/,
    );
  });
});
