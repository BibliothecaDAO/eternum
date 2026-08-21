import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readStructureManagerSource = (): string => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
};

describe("structure manager cosmetics refresh wiring", () => {
  it("re-resolves cosmetics for a specific owner and rebuilds only their structures", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/public\s+refreshCosmeticsForOwner\s*\(\s*owner:\s*string\s*\|\s*bigint\s*\)/);
    expect(source).toMatch(/this\.worldSpatialProjection\.getStructures\(\)\.flatMap/);
    expect(source).toMatch(/getComponentValue\(this\.components\.Structure/);
    expect(source).toMatch(/void\s+this\.requestVisibleStructuresRefresh\s*\(\{\s*refreshEntityIds\s*\}\)/);
  });

  it("does not maintain a second structure truth store", () => {
    const source = readStructureManagerSource();

    expect(source).not.toMatch(/StructureRecordStore|refreshStructureCosmeticsByOwner/);
  });
});
