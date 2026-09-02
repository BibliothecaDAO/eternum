import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function readTerrainVisibilityHealthMonitorSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap-terrain-visibility-health-monitor.ts"), "utf8");
}

describe("worldmap refresh scheduler wiring", () => {
  it("routes bursty force-refresh hot paths through requestChunkRefresh with reasons", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/requestChunkRefresh\(true,\s*"visibility_recovery"\)/);
    expect(source).toMatch(/requestChunkRefresh\(true,\s*"hydrated_chunk"\)/);
  });

  // The terrain/offscreen self-heal force-refreshes moved to the health monitor collaborator;
  // the same discipline (each hot path forces a refresh with its reason) is enforced at that home.
  it("forces terrain self-heal refreshes with reasons from the health monitor", () => {
    const monitorSource = readTerrainVisibilityHealthMonitorSource();

    expect(monitorSource).toMatch(/requestChunkRefresh\(true,\s*"offscreen_chunk"\)/);
    expect(monitorSource).toMatch(/requestChunkRefresh\(true,\s*"terrain_self_heal"\)/);
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
