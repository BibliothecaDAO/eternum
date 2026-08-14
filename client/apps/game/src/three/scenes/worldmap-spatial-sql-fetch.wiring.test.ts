// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractGlobalSpatialHydration = (source: string): string => {
  const start = source.indexOf("  private async hydrateRenderAreaFromGlobalSpatialState");
  const end = source.indexOf("  private shouldFetchTileOpt", start);
  return source.slice(start, end);
};

describe("worldmap global spatial hydration", () => {
  it("hydrates remaining render state without rebuilding chest truth per area", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodSource = extractGlobalSpatialHydration(source);

    expect(source).not.toContain("private async runSpatialSqlFetch");
    expect(source).not.toContain("spatial_sql_fetch_timeout");
    expect(methodSource).toContain("hydrateExploredTilesFromGlobalTileOptRecs");
    expect(methodSource).toContain("hydrateStructuresFromGlobalTileOptRecs");
    expect(methodSource).toContain("applyStructureTileUpdate");
    expect(methodSource).toContain("global_spatial_recs_hydrated");
    expect(source).not.toContain("hydrateChestsFromGlobalTileOptRecs");
    expect(source).not.toContain("chestManager.onUpdate");
    expect(source).not.toContain("repairChestTileIfStale");
    expect(source).toContain("worldSpatialProjection.getChestsAtHex");
  });
});
