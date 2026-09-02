import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager projection update wiring", () => {
  it("drives the visible presentation refresh from the projection change set, not a bounds re-query", () => {
    const source = readStructureManagerSource();
    const handler = source.slice(
      source.indexOf("private handleStructureProjectionChanges("),
      source.indexOf("private applyStructureChangesToVisibleWindow("),
    );

    expect(source).toMatch(/worldSpatialProjection\.subscribeStructures\(\(changes\) =>/);
    expect(source).toMatch(/this\.handleStructureProjectionChanges\(changes\)/);
    expect(handler).toMatch(/this\.applyStructureChangesToVisibleWindow\(changes\)/);
    expect(handler).toMatch(/void this\.requestVisibleStructuresRefresh\(\{ refreshEntityIds \}\)/);
    expect(handler).not.toContain("getStructuresInBounds");
  });

  it("re-queries structure bounds only when the window's chunk changes", () => {
    const source = readStructureManagerSource();
    const passBody = source.slice(
      source.indexOf("private async performVisibleStructuresUpdate("),
      source.indexOf("private resolveVisibleStructureCommitOwner("),
    );

    expect(passBody).toMatch(/this\.resolveVisibleStructuresForChunk\(visibleStructurePassSnapshot\.chunkKey\)/);
    expect(passBody).not.toContain("getStructuresInBounds");
    expect(source).toMatch(/if \(this\.visibleStructureWindow\?\.chunkKey === chunkKey\)/);
  });
});
