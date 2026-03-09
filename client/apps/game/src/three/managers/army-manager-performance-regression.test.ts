import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army manager performance regressions", () => {
  it("keeps chunk reconcile off linear visible-order membership scans", () => {
    const source = readArmyManagerSource();

    expect(source).not.toContain("this.visibleArmyOrder.includes(");
    expect(source).not.toContain("this.visibleArmyOrder.indexOf(");
  });

  it("rebuilds model info without sorting visible armies", () => {
    const source = readArmyManagerSource();

    expect(source).not.toContain("const sortedVisibleArmies = visibleArmies.toSorted");
    expect(source).not.toContain("collectModelInfo(sortedVisibleArmies)");
  });

  it("indexes armies by owning structure for targeted owner sync", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private\s+armiesByOwningStructure:\s*Map<ID,\s*Set<ID>>\s*=\s*new Map\(\)/);
    expect(source).toMatch(/public\s+getArmiesForStructure\s*\(\s*structureId:\s*ID\s*\)/);
    expect(source).toMatch(
      /public\s+syncAttachedArmiesOwnerForStructure[\s\S]*const\s+attachedArmyIds\s*=\s*this\.armiesByOwningStructure\.get\(params\.structureId\)/,
    );
  });
});
