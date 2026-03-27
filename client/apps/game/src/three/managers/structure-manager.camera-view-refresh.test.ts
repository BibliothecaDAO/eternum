import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager camera view refresh", () => {
  it("refreshes structure label content after camera view changes", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(
      /applyLabelTransitions\(this\.entityIdLabels, view\);\s*this\.refreshStructureLabelsForCameraView\(\);/,
    );
    expect(source).toMatch(/private refreshStructureLabelsForCameraView\(\): void \{/);
    expect(source).toMatch(/updateStructureLabel\(label\.element, structure, this\.currentCameraView\);/);
  });
});
