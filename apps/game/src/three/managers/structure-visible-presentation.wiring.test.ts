import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("structure visible presentation wiring", () => {
  it("routes projected render passes through shared presentation helpers", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/this\.syncVisibleStructurePresentation\(structure, rotationY, attachmentRetain\)/);
    expect(source).toMatch(/private syncVisibleStructurePresentation\(/);
    expect(source).toMatch(/private resolveVisibleStructureRotationY\(/);
  });
});
