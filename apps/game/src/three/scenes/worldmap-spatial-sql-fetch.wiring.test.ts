// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractProjectionProjectionSync = (source: string): string => {
  const start = source.indexOf("  private async syncProjectionTilesForChunk");
  const end = source.indexOf("  private toContractBounds", start);
  return source.slice(start, end);
};

describe("worldmap projection tile sync", () => {
  it("syncs terrain from the projection without any spatial SQL read", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodSource = extractProjectionProjectionSync(source);

    expect(source).not.toContain("private async runSpatialSqlFetch");
    expect(source).not.toContain("spatial_sql_fetch_timeout");
    expect(methodSource).toContain("worldSpatialProjection.getTilesInBounds");
    expect(methodSource).toContain("syncExploredTilesFromProjection");
    expect(methodSource).toContain("projection_tiles_synced");
    expect(methodSource).not.toContain("hydrateStructuresFromGlobalTileOptRecs");
    expect(methodSource).not.toContain("applyStructureTileUpdate");
    expect(source).not.toContain("hydrateChestsFromGlobalTileOptRecs");
    expect(source).not.toContain("chestManager.onUpdate");
    expect(source).not.toContain("repairChestTileIfStale");
    expect(source).toContain("worldSpatialProjection.getChestsAtHex");
    expect(source).toContain("worldSpatialProjection.getStructuresAtHex");
  });
});
