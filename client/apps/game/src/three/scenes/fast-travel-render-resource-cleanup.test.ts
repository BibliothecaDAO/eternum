import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "fast-travel.ts"), "utf8");
}

describe("FastTravelScene render resource cleanup", () => {
  it("uses shared render assets and disposes them at scene teardown", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/createFastTravelRenderAssets/);
    expect(source).toMatch(/this\.renderAssets\.createHexEdgeMesh\(/);
    expect(source).toMatch(/this\.renderAssets\.dispose\(\)/);
  });
});
