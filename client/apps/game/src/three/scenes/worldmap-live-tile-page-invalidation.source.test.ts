// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");

const extractMethod = (startMarker: string, endMarker: string): string => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return source.slice(start, end);
};

describe("worldmap live tile page invalidation", () => {
  it("consumes authoritative tile projection changes instead of the legacy scene listener", () => {
    const lifecycle = extractMethod(
      "  private bindWorldSpatialProjectionLifecycle(): void {",
      "  private syncProjectedArmyPathfinding(",
    );

    expect(lifecycle).toContain("this.worldSpatialProjection.subscribeTiles");
    expect(lifecycle).toContain("this.handleProjectedTileChanges(changes)");
    expect(source).not.toContain("worldUpdateListener.Tile");
  });

  it("writes projection truth before invalidating the owning visual page", () => {
    const handler = extractMethod(
      "  private handleProjectedTileChanges(",
      "  private applyProjectedExploredTileChange(",
    );

    expect(handler.indexOf("this.applyProjectedExploredTileChange")).toBeLessThan(
      handler.indexOf("this.invalidateVisualTerrainPageForLiveTile"),
    );
  });

  it("coalesces live writes behind a page revision and rebuilds through the page pipeline", () => {
    const invalidation = extractMethod(
      "  private invalidateVisualTerrainPageForLiveTile(",
      "  private async refreshVisualTerrainWindowForFocus(",
    );

    expect(invalidation).toContain("resolveWorldmapVisualTerrainPageKeyForHex");
    expect(invalidation).toContain("this.visualTerrainPageRevisions.set");
    expect(invalidation).toContain("this.liveTilePageRebuilds.has");
    expect(invalidation).toContain("await waitForChunkTransitionToSettle");
    expect(invalidation).toContain("await this.buildAndApplyVisualTerrainPage");
    expect(invalidation).toContain("preserveCoverageAuthority: true");
    expect(invalidation).not.toContain("requestChunkRefresh");
    expect(invalidation).not.toContain("setMatrixAt");
  });

  it("stale-drops page builds that predate the latest live tile write", () => {
    const guard = extractMethod(
      "  private shouldApplyVisualTerrainPageBuild(",
      "  private commitVisualTerrainPageBuild(",
    );

    expect(guard).toContain("request.revision === this.getVisualTerrainPageRevision(request.pageKey)");
  });
});
