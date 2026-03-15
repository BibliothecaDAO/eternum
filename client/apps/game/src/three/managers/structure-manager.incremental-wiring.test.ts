import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager incremental update wiring", () => {
  it("uses a patch path for visible single-entity updates before falling back to rebuild", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/resolveVisibleStructureUpdateMode\(/);
    expect(source).toMatch(/visibleUpdateMode === "patch" && existingStructure && structureRecord/);
    expect(source).toMatch(/this\.patchVisibleStructure\(/);
  });
});
