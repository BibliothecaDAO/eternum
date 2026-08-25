import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("ArmyManager pre-commit army queue", () => {
  it("declares a preCommitArmyQueue as a Set<ID>", () => {
    const source = readSource("./army-manager.ts");

    const setDeclaration =
      source.includes("preCommitArmyQueue: Set<") || source.includes("preCommitArmyQueue = new Set");

    expect(setDeclaration).toBe(true);
  });

  it("renderArmyIntoCurrentChunkIfVisible queues to preCommitArmyQueue when chunk is uncommitted", () => {
    const source = readSource("./army-manager.ts");

    const methodStart = source.indexOf("renderArmyIntoCurrentChunkIfVisible(entityId: ID)");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart);

    // Find the uncommitted chunk guard
    const uncommittedGuardIdx = bodyAfterMethod.indexOf("if (!isCommittedManagerChunk");
    expect(uncommittedGuardIdx).toBeGreaterThan(-1);

    // The guard body should add to preCommitArmyQueue instead of just returning false
    const guardBody = bodyAfterMethod.substring(uncommittedGuardIdx, uncommittedGuardIdx + 200);
    expect(guardBody).toContain("this.preCommitArmyQueue.add(entityId)");
  });

  it("drainPreCommitArmyQueue method exists and drains the queue", () => {
    const source = readSource("./army-manager.ts");

    const methodStart = source.indexOf("drainPreCommitArmyQueue(): void");
    expect(methodStart).toBeGreaterThan(-1);

    // Extract just this method body (up to the next private/public method)
    const bodyAfterMethod = source.substring(methodStart, methodStart + 500);

    // Should copy, clear, then iterate — same pattern as drainDeferredArmyQueue
    const spreadIdx = bodyAfterMethod.indexOf("[...this.preCommitArmyQueue]");
    const clearIdx = bodyAfterMethod.indexOf("this.preCommitArmyQueue.clear()");
    const forOfIdx = bodyAfterMethod.indexOf("for (const entityId of");

    expect(spreadIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(forOfIdx).toBeGreaterThan(-1);

    // Order: copy → clear → iterate
    expect(spreadIdx).toBeLessThan(clearIdx);
    expect(clearIdx).toBeLessThan(forOfIdx);
  });

  it("routes winning transition cleanup through the shared finalizer", () => {
    const source = readSource("./army-manager.ts");

    // Find the executeRenderForChunk method definition (private async)
    const methodStart = source.indexOf("private async executeRenderForChunk(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.substring(methodStart);
    const finallyIdx = methodBody.indexOf("} finally {");
    expect(finallyIdx).toBeGreaterThan(-1);

    const finallyBlock = methodBody.substring(finallyIdx, finallyIdx + 900);

    expect(finallyBlock).toContain("finalizeArmyChunkTransition({");
    expect(finallyBlock).toContain("drainPreCommitQueue: () => this.drainPreCommitArmyQueue()");
  });

  it("passes deferred then pre-commit drains to the shared finalizer", () => {
    const source = readSource("./army-manager.ts");

    const methodStart = source.indexOf("private async executeRenderForChunk(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.substring(methodStart);
    const finallyIdx = methodBody.indexOf("} finally {");
    expect(finallyIdx).toBeGreaterThan(-1);

    const finallyBlock = methodBody.substring(finallyIdx, finallyIdx + 900);

    const deferredDrainIdx = finallyBlock.indexOf("drainDeferredQueue: () => this.drainDeferredArmyQueue()");
    const preCommitDrainIdx = finallyBlock.indexOf("drainPreCommitQueue: () => this.drainPreCommitArmyQueue()");

    expect(deferredDrainIdx).toBeGreaterThan(-1);
    expect(preCommitDrainIdx).toBeGreaterThan(-1);

    // The finalizer executes these callbacks in this declared order.
    expect(preCommitDrainIdx).toBeGreaterThan(deferredDrainIdx);
  });

  it("preCommitArmyQueue is cleared during destroy", () => {
    const source = readSource("./army-manager.ts");

    // Find destroy method
    const destroyIdx = source.indexOf("destroy()");
    expect(destroyIdx).toBeGreaterThan(-1);

    const bodyAfterDestroy = source.substring(destroyIdx);

    expect(bodyAfterDestroy).toContain("this.preCommitArmyQueue.clear()");
  });
});
