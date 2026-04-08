import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("structure visible instance binding wiring", () => {
  it("routes base and cosmetic render loops through named binding helpers", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/this\.bindVisibleStructureInstance\(/);
    expect(source).toMatch(/nextActiveStructureModels/);
    expect(source).toMatch(/this\.bindVisibleCosmeticStructureInstance\(/);
    expect(source).toMatch(/nextActiveCosmeticStructureModels/);
    expect(source).toMatch(/private bindVisibleStructureInstance\(/);
    expect(source).toMatch(/private bindVisibleCosmeticStructureInstance\(/);
  });
});
