import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap spire travel ownership wiring", () => {
  it("resolves both armies through ECS ownership when deciding whether spire traversal is hostile", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private canAttackSpireTraversalArmy(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 1200);
    expect(methodBody).toContain("this.resolveArmyOwnerAddress(selectedArmyId)");
    expect(methodBody).toContain("this.resolveArmyOwnerAddress(targetArmyId)");
  });
});
