// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

function extractMethod(source: string, methodName: string): string {
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
      return source.slice(methodStart, index + 1);
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

describe("worldmap sparse global spatial hydration", () => {
  it("uses sparse hydration super-areas without enlarging terrain hydration", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("private getExplorerTroopsRenderAreaKeyForChunk(");
    expect(source).toContain("private getExplorerTroopsFetchBoundsForArea(");
    expect(source).toContain("private getExplorerTroopsHydrationKey(");
    expect(source).toContain("private getExplorerTroopsAreaKeyFromHydrationKey(");
    expect(source).toContain("private getStructuresRenderAreaKeyForChunk(");
    expect(source).toContain("private getStructuresFetchBoundsForArea(");
    expect(source).toContain("private getStructuresHydrationKey(");
    expect(source).toContain("private getStructuresAreaKeyFromHydrationKey(");
    expect(source).toContain("EXPLORER_TROOPS_HYDRATION_KEY_PREFIX");
    expect(source).toContain("STRUCTURES_HYDRATION_KEY_PREFIX");
    expect(source).toContain("WORLDMAP_CHUNK_POLICY.toriiFetch.explorerTroopsSuperAreaStrides");
    expect(source).toContain("WORLDMAP_CHUNK_POLICY.toriiFetch.structuresSuperAreaStrides");

    const renderAreaMethod = extractMethod(source, "private getRenderAreaKeyForChunk(");
    expect(renderAreaMethod).toContain("WORLDMAP_CHUNK_POLICY.toriiFetch.superAreaStrides");
    expect(renderAreaMethod).not.toContain("explorerTroopsSuperAreaStrides");
    expect(renderAreaMethod).not.toContain("structuresSuperAreaStrides");

    const troopAreaMethod = extractMethod(source, "private getExplorerTroopsRenderAreaKeyForChunk(");
    expect(troopAreaMethod).toContain("this.getExplorerTroopsHydrationKey(areaKey)");

    const structuresAreaMethod = extractMethod(source, "private getStructuresRenderAreaKeyForChunk(");
    expect(structuresAreaMethod).toContain("this.getStructuresHydrationKey(areaKey)");
  });

  it("keeps structures out of the TileOpt hydration plan", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const hydrationPlanBody = extractMethod(source, "private resolveRenderAreaHydrationFetchPlans(");

    expect(hydrationPlanBody).toContain('const terrainStages = requiredStages.filter((stage) => stage === "tileOpt")');
    expect(hydrationPlanBody).toContain("this.getStructuresRenderAreaKeyForChunk(chunkKey)");
    expect(hydrationPlanBody).toContain('stages: ["structures"]');
    expect(hydrationPlanBody).toContain("this.getExplorerTroopsRenderAreaKeyForChunk(chunkKey)");
    expect(hydrationPlanBody).toContain('stages: ["explorerTroops"]');
  });

  it("reuses completed sparse hydration because global spatial RECS is authoritative", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const completeBody = extractMethod(source, "private isRenderAreaHydrationPlanComplete(");
    const fetchStagesBody = extractMethod(source, "private resolveRenderAreaHydrationStagesToFetchForPlan(");

    expect(completeBody).toContain(
      "isRenderAreaHydrationComplete(this.renderAreaHydrationState, plan.fetchKey, plan.stages)",
    );
    expect(fetchStagesBody).toContain("this.resolveRenderAreaHydrationStagesToFetch(plan.fetchKey, plan.stages)");
    expect(source).not.toContain("private isSparseHydrationPlanReusable(");
    expect(source).not.toContain("this.getActiveToriiSubscriptionBounds()");
  });

  it("does not keep per-area explorer troop SQL backoff in the presentation path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("shouldSkipExplorerTroopsSpatialSqlFetch");
    expect(source).not.toContain("recordExplorerTroopsSpatialSqlBackoff");
    expect(source).not.toContain("getExplorerTroopsFromToriiExact(");
    expect(source).not.toContain("private async fetchRenderAreaHydrationStages(");
  });

  it("marks sparse global hydration applicable without active subscription bounds", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const applyBody = extractMethod(source, "private shouldApplyHydrationFetchResult(");

    expect(applyBody).toContain("this.isExplorerTroopsOnlyHydration(stages) || this.isStructuresOnlyHydration(stages)");
    expect(applyBody).toContain("return true;");
    expect(source).not.toContain("private shouldApplyExplorerTroopsHydrationFetchResult(");
    expect(source).not.toContain("private shouldApplyStructuresHydrationFetchResult(");
  });

  it("checks directional prefetch hydration across split terrain and troop fetch keys", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const prefetchBody = extractMethod(source, "private prefetchDirectionalChunks(");
    expect(prefetchBody).toContain("this.isRenderAreaHydrationCompleteForFetchKey(");

    const completionLookupBody = extractMethod(source, "private getRenderAreaHydrationCompletionLookup(");
    expect(completionLookupBody).toContain("this.isRenderAreaHydrationCompleteForFetchKey(fetchKey, requiredStages)");

    const pendingLookupBody = extractMethod(source, "private getRenderAreaHydrationPendingLookup(");
    expect(pendingLookupBody).toContain("this.hasPendingRenderAreaHydrationForFetchKey(fetchKey, requiredStages)");

    const stageFetchKeyBody = extractMethod(source, "private resolveRenderAreaHydrationFetchKeyForStage(");
    expect(stageFetchKeyBody).toContain('stage === "explorerTroops"');
    expect(stageFetchKeyBody).toContain("this.getExplorerTroopsRenderAreaKeyForChunk(fetchKey)");
    expect(stageFetchKeyBody).toContain('stage === "structures"');
    expect(stageFetchKeyBody).toContain("this.getStructuresRenderAreaKeyForChunk(fetchKey)");
  });

  it("waits for structure hydration using the structure-specific fetch key", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const waitBody = extractMethod(source, "private async waitForStructureHydrationIdle(");

    expect(waitBody).toContain("this.getStructuresRenderAreaKeyForChunk(chunkKey)");
    expect(waitBody).not.toContain("this.getRenderAreaKeyForChunk(chunkKey)");
  });
});
