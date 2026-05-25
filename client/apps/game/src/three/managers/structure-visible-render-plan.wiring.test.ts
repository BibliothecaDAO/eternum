import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("structure visible render plan wiring", () => {
  it("routes performVisibleStructuresUpdate through named render-plan helpers", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/const renderPlan = this\.createVisibleStructureRenderPlan\(visibleStructures\)/);
    expect(source).toMatch(/await this\.preloadVisibleStructureRenderPlan\(renderPlan\)/);
    expect(source).toMatch(/for \(const \[structureType, structures\] of renderPlan\.structuresByType\)/);
    expect(source).toMatch(/for \(const \[cosmeticId, structures\] of renderPlan\.structuresByCosmeticId\)/);
  });
});
