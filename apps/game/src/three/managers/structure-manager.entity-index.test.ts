import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, "structure-manager.ts");
  return readFileSync(filePath, "utf8");
}

describe("Structure projection entity lookup", () => {
  it("resolves structure membership from the shared spatial projection", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/this\.worldSpatialProjection\.getStructure\(entityId\)/);
    expect(source).not.toMatch(/StructureRecordStore/);
  });
});
