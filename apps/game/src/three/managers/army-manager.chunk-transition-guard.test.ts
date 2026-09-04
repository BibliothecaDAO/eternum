import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("ArmyManager chunk-transition guard", () => {
  it("executeRenderForChunk sets isArmyChunkTransitioning to true before try block", () => {
    const source = readSource("./army-manager.ts");

    const renderStart = source.indexOf("private async executeRenderForChunk(");
    const transitionTrueIdx = source.indexOf("this.isArmyChunkTransitioning = true", renderStart);
    const startRowIdx = source.indexOf('const [startRow, startCol] = chunkKey.split(",")', renderStart);

    expect(transitionTrueIdx).toBeGreaterThan(-1);
    expect(startRowIdx).toBeGreaterThan(-1);

    // isArmyChunkTransitioning = true must appear before the try block content
    expect(transitionTrueIdx).toBeLessThan(startRowIdx);
  });

  it("routes finally cleanup through the winning-transition finalizer", () => {
    const source = readSource("./army-manager.ts");

    const finallyIdx = source.indexOf("} finally {", source.indexOf("private async executeRenderForChunk("));
    expect(finallyIdx).toBeGreaterThan(-1);

    const finalizerIdx = source.indexOf("finalizeArmyChunkTransition({", finallyIdx);
    expect(finalizerIdx).toBeGreaterThan(finallyIdx);
    expect(source.slice(finalizerIdx)).toMatch(/isWinningTransition: shouldRunManagerChunkUpdate\(\{/);
  });

  it("hands both owned queues to the transition finalizer", () => {
    const source = readSource("./army-manager.ts");

    const finallyIdx = source.indexOf("} finally {", source.indexOf("private async executeRenderForChunk("));
    expect(finallyIdx).toBeGreaterThan(-1);

    const finalizerBlock = source.slice(finallyIdx, source.indexOf("recordWorldmapRenderDuration", finallyIdx));
    expect(finalizerBlock).toMatch(/drainDeferredQueue: \(\) => this\.drainDeferredArmyQueue\(\)/);
    expect(finalizerBlock).toMatch(/drainPreCommitQueue: \(\) => this\.drainPreCommitArmyQueue\(\)/);
  });

  it("renderArmyIntoCurrentChunkIfVisible guards against chunk transition", () => {
    const source = readSource("./army-manager.ts");

    // Extract the renderArmyIntoCurrentChunkIfVisible method body
    const methodStart = source.indexOf("renderArmyIntoCurrentChunkIfVisible(entityId: ID)");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart);

    const chunkTransitionGuardIdx = bodyAfterMethod.indexOf("if (this.isArmyChunkTransitioning)");
    const committedChunkGuardIdx = bodyAfterMethod.indexOf("if (!isCommittedManagerChunk");

    expect(chunkTransitionGuardIdx).toBeGreaterThan(-1);
    expect(committedChunkGuardIdx).toBeGreaterThan(-1);

    // The chunk transition guard must appear before the committed chunk check
    expect(chunkTransitionGuardIdx).toBeLessThan(committedChunkGuardIdx);
  });

  it("deferred army queue uses Set for deduplication", () => {
    const source = readSource("./army-manager.ts");

    // Check for Set-based declaration
    const setDeclaration = source.includes("deferredArmyQueue: Set<") || source.includes("deferredArmyQueue = new Set");

    expect(setDeclaration).toBe(true);
  });

  it("drainDeferredArmyQueue clears queue before iterating", () => {
    const source = readSource("./army-manager.ts");

    // Find the drainDeferredArmyQueue method
    const methodStart = source.indexOf("drainDeferredArmyQueue(): void");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart);

    // Spread/copy the queue, then clear, then iterate
    const spreadIdx = bodyAfterMethod.indexOf("[...this.deferredArmyQueue]");
    const clearIdx = bodyAfterMethod.indexOf("this.deferredArmyQueue.clear()");
    const forOfIdx = bodyAfterMethod.indexOf("for (const entityId of");

    expect(spreadIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(forOfIdx).toBeGreaterThan(-1);

    // Order: copy → clear → iterate (prevents infinite loop)
    expect(spreadIdx).toBeLessThan(clearIdx);
    expect(clearIdx).toBeLessThan(forOfIdx);
  });
});
