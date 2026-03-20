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

    const transitionTrueIdx = source.indexOf("this.isArmyChunkTransitioning = true");
    const startRowIdx = source.indexOf('const [startRow, startCol] = chunkKey.split(",")');

    expect(transitionTrueIdx).toBeGreaterThan(-1);
    expect(startRowIdx).toBeGreaterThan(-1);

    // isArmyChunkTransitioning = true must appear before the try block content
    expect(transitionTrueIdx).toBeLessThan(startRowIdx);
  });

  it("isArmyChunkTransitioning is reset to false in finally block", () => {
    const source = readSource("./army-manager.ts");

    // Find the finally block in executeRenderForChunk
    const finallyIdx = source.indexOf("} finally {", source.indexOf("executeRenderForChunk"));
    expect(finallyIdx).toBeGreaterThan(-1);

    const resetIdx = source.indexOf("this.isArmyChunkTransitioning = false", finallyIdx);
    expect(resetIdx).toBeGreaterThan(-1);

    // The reset must be inside the finally block (close to it)
    expect(resetIdx).toBeGreaterThan(finallyIdx);
  });

  it("drainDeferredArmyQueue is called after transition flag reset", () => {
    const source = readSource("./army-manager.ts");

    const finallyIdx = source.indexOf("} finally {", source.indexOf("executeRenderForChunk"));
    expect(finallyIdx).toBeGreaterThan(-1);

    const resetIdx = source.indexOf("this.isArmyChunkTransitioning = false", finallyIdx);
    const drainIdx = source.indexOf("this.drainDeferredArmyQueue()", finallyIdx);

    expect(resetIdx).toBeGreaterThan(-1);
    expect(drainIdx).toBeGreaterThan(-1);

    // drain must come after the flag reset
    expect(drainIdx).toBeGreaterThan(resetIdx);
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
