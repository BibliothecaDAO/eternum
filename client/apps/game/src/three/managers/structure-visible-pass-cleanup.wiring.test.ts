import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("structure visible pass cleanup wiring", () => {
  it("routes post-pass cleanup through a named finalizer", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/this\.finalizeVisibleStructurePass\(visibleStructureIds, attachmentRetain\)/);
    expect(source).toMatch(/private finalizeVisibleStructurePass\(/);
  });
});
