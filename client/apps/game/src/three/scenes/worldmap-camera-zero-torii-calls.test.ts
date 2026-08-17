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

describe("worldmap camera movement performs zero Torii fetches", () => {
  it("syncs visible terrain from the in-memory projection", () => {
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
    expect(projectionSync).not.toMatch(/toriiClient|getEntities|getMapFromTorii|fetch\s*\(/);
    expect(source).not.toMatch(/LegacyBounded|toriiStreamManager|updateToriiBoundsSubscription/);
  });

  it("has no remaining exact spatial query helper for camera-driven reads", () => {
    const queries = readSource("src/dojo/queries.ts");

    expect(queries).not.toContain("getMapFromTorii");
    expect(queries).not.toContain("getStructuresFromToriiExact");
    expect(queries).not.toContain("getTilesForPositionsFromTorii");
  });
});
