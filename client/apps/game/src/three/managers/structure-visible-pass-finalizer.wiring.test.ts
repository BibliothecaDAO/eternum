import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("structure visible pass finalizer wiring", () => {
  it("routes model-pass finalization through a named helper", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/this\.finalizeVisibleStructureModelPass\(/);
    expect(source).toMatch(/nextActiveCosmeticStructureModels/);
    expect(source).toMatch(/private finalizeVisibleStructureModelPass\(/);
  });
});
