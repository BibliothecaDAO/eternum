import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene surface orchestration", () => {
  it("refreshes interactive visible hexes for the current fast-travel window", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/syncFastTravelInteractiveHexes/);
    expect(source).toMatch(/interactiveHexManager\.clearHexes\(\)/);
    expect(source).toMatch(/interactiveHexManager\.addHex\(/);
    expect(source).toMatch(/interactiveHexManager\.updateVisibleHexes\(/);
  });

  it("routes army and spire visuals through anchored entity descriptors", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/buildFastTravelEntityAnchors/);
    expect(source).toMatch(/currentEntityAnchors/);
  });
});
