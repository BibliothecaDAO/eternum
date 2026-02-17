import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const worldmapSource = readFileSync(path.resolve(__dirname, "worldmap.tsx"), "utf8");

describe("Worldmap updateExploredHex integration wiring", () => {
  it("computes duplicate reconcile plan from unified decision input", () => {
    const computesBiomeDelta = /const hasBiomeDelta\s*=\s*!removeExplored && tileAlreadyKnown && existingBiome !== biome;/.test(
      worldmapSource,
    );
    const computesReconcilePlan = /const duplicateTilePlan = resolveDuplicateTileReconcilePlan\(duplicateTileDecisionInput\);/.test(
      worldmapSource,
    );

    expect(computesBiomeDelta).toBe(true);
    expect(computesReconcilePlan).toBe(true);
  });

  it("runs immediate refresh for immediate strategy and defers otherwise", () => {
    const hasImmediateRefreshBranch =
      /if\s*\(duplicateTilePlan\.refreshStrategy === "immediate"\)\s*\{\s*void this\.updateVisibleChunks\(true\)/s.test(
        worldmapSource,
      );
    const hasDeferredRefreshBranch = /else\s*\{\s*this\.requestChunkRefresh\(true\);\s*\}/s.test(worldmapSource);

    expect(hasImmediateRefreshBranch).toBe(true);
    expect(hasDeferredRefreshBranch).toBe(true);
  });
});
