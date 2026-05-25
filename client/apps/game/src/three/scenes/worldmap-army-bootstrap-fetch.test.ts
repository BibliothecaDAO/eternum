import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractMethodBody(source: string, methodName: string): string {
  const methodStart = source.indexOf(methodName);
  expect(methodStart).toBeGreaterThan(-1);

  const signatureEnd = findMethodSignatureEnd(source, methodStart + methodName.length);
  const bodyStart = source.indexOf("{", signatureEnd);
  expect(bodyStart).toBeGreaterThan(-1);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
    }
    if (depth === 0) {
      return source.slice(bodyStart, index + 1);
    }
  }

  throw new Error(`Unable to extract ${methodName}`);
}

function findMethodSignatureEnd(source: string, searchStart: number): number {
  let depth = 1;
  for (let index = searchStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") {
      depth += 1;
    }
    if (character === ")") {
      depth -= 1;
    }
    if (depth === 0) {
      return index;
    }
  }

  throw new Error("Unable to find method signature end");
}

describe("worldmap army bootstrap fetch", () => {
  it("hydrates army bootstrap render areas from global spatial RECS instead of exact SQL", () => {
    const source = readWorldmapSource();

    expect(source).not.toContain("getExplorerTroopsFromToriiExact");
    expect(source).not.toContain("getMapFromToriiExact");
    expect(source).not.toContain("getStructuresFromToriiExact");

    const computeMethodBody = extractMethodBody(source, "private async computeTileEntities(");
    expect(computeMethodBody).toContain("this.resolveRenderAreaHydrationFetchPlans(chunkKey, requiredStages)");

    const hydrationPlanBody = extractMethodBody(source, "private resolveRenderAreaHydrationFetchPlans(");
    expect(hydrationPlanBody).toContain("this.getExplorerTroopsRenderAreaKeyForChunk(chunkKey)");
    expect(hydrationPlanBody).toContain('stages: ["explorerTroops"]');

    const fetchMethodBody = extractMethodBody(source, "private async executeTileEntitiesFetch(");
    expect(fetchMethodBody).toContain(
      "await this.hydrateRenderAreaFromGlobalSpatialState(fetchKey, localBounds, stages)",
    );
    const stagedHydrationBody = extractMethodBody(source, "private async hydrateRenderAreaFromGlobalSpatialState(");
    expect(stagedHydrationBody).toContain("hydrateExploredTilesFromGlobalTileOptRecs");
    expect(stagedHydrationBody).toContain("hydrateStructuresFromGlobalTileOptRecs");
    expect(stagedHydrationBody).toContain("global_spatial_recs_hydrated");
  });
});
