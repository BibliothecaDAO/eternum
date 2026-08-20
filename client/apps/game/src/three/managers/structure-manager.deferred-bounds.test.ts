import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("StructureManager deferred bounds", () => {
  it("setChunkBounds does not propagate worldBounds to instanced models directly", () => {
    const source = readSource("./structure-manager.ts");

    // Extract the setChunkBounds method body
    const setChunkBoundsMatch = source.match(/public setChunkBounds\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
    expect(setChunkBoundsMatch).not.toBeNull();
    const methodBody = setChunkBoundsMatch![1];

    // setChunkBounds should NOT call setWorldBounds on models — that causes ghosting
    // when bounds update before instance data is rebuilt
    expect(methodBody).not.toContain("setWorldBounds");
  });

  it("setChunkBounds invalidates any in-flight visible structure pass before deferring new bounds", () => {
    const source = readSource("./structure-manager.ts");

    const setChunkBoundsMatch = source.match(/public setChunkBounds\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
    expect(setChunkBoundsMatch).not.toBeNull();
    const methodBody = setChunkBoundsMatch![1];

    expect(methodBody).toContain("this.visibleStructurePassFence.invalidate()");
    expect(methodBody.indexOf("this.visibleStructurePassFence.invalidate()")).toBeLessThan(
      methodBody.indexOf("this.hasPendingModelBounds = true"),
    );
  });

  it("commits dirty slot counts before applying pending model world bounds", () => {
    const managerSource = readSource("./structure-manager.ts");
    const commitMethod = managerSource.slice(
      managerSource.indexOf("private commitVisibleStructureDiff("),
      managerSource.indexOf("private addVisibleStructureInstance("),
    );
    const applyCountsIdx = commitMethod.indexOf("this.updateVisibleStructureModelCounts(dirtyModels)");
    const applyBoundsIdx = commitMethod.indexOf("this.applyPendingModelBounds()");

    expect(applyCountsIdx).toBeGreaterThan(-1);
    expect(applyBoundsIdx).toBeGreaterThan(-1);
    expect(applyCountsIdx).toBeLessThan(applyBoundsIdx);
  });
});
