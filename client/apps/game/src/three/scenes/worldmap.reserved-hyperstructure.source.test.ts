import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap reserved hyperstructure interaction", () => {
  it("creates reserved hyperstructures from the worldmap double-click seam", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("if (this.isReservedHyperstructureHex(hexCoords)) {");
    expect(source).toContain("void this.createReservedHyperstructureFromWorldmap(hexCoords);");
    expect(source).toContain("await submitActiveWorldBlitzHyperstructureCreation({");
  });

  it("deduplicates repeated clicks until the reserved tile clears", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toContain("if (isPendingReservedHyperstructureCreation(hexCoords)) {");
    expect(source).toContain("this.worldSpatialProjection.subscribeStructures((changes) => {");
    expect(source).toContain("if (previous?.reserved && !current?.reserved) {");
    expect(source).toContain("clearPendingReservedHyperstructureCreation(previous.hexCoords);");
  });
});
