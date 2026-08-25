import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager projection update wiring", () => {
  it("coalesces projection changes into the visible presentation refresh", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/worldSpatialProjection\.subscribeStructures\(\(changes\) =>/);
    expect(source).toMatch(/this\.handleStructureProjectionChanges\(changes\)/);
    expect(source).toMatch(/void this\.requestVisibleStructuresRefresh\(\{ refreshEntityIds \}\)/);
  });
});
