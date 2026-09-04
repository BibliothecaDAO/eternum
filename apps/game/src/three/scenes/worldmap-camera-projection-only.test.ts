// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractMethod = (source: string, signature: string, nextSignature: string): string => {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("worldmap camera movement reads only the in-memory projection", () => {
  it("syncs visible terrain without network fetches", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const projectionSync = extractMethod(
      source,
      "  private async syncProjectionTilesForChunk",
      "  private toContractBounds",
    );
    const presentation = extractMethod(
      source,
      "  private prepareChunkPresentation",
      "  private recordPreparedTerrainReady",
    );

    expect(presentation).toContain("syncProjectionTiles: (targetChunkKey) => this.syncProjectionTilesForChunk");
    expect(projectionSync).toContain("this.worldSpatialProjection.getTilesInBounds");
    expect(projectionSync).not.toMatch(/getEntities|getMapFromIndex|fetch\s*\(/);
    expect(source).not.toMatch(/LegacyBounded|updateBoundsSubscription/);
  });
});
