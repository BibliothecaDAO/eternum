import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("FastTravelScene interaction surface", () => {
  it("hides the interactive picking mesh while preserving the shared input manager", () => {
    const fastTravelSource = readSceneSource("fast-travel.ts");
    const interactiveManagerSource = readSceneSource("../managers/interactive-hex-manager.ts");

    expect(fastTravelSource).toMatch(/interactiveHexManager\.setSurfaceVisibility\(false\)/);
    expect(fastTravelSource).toMatch(/interactiveHexManager\.updateVisibleHexes\(/);
    expect(interactiveManagerSource).toMatch(/setSurfaceVisibility\(visible: boolean\)/);
    expect(interactiveManagerSource).toMatch(/material\.colorWrite = this\.surfaceVisible/);
    expect(interactiveManagerSource).toMatch(/material\.depthWrite = this\.surfaceVisible/);
  });

  it("renders the base field through outline geometry only", () => {
    const fastTravelSource = readSceneSource("fast-travel.ts");

    expect(fastTravelSource).toMatch(/group\.add\(this\.renderAssets\.createHexEdgeMesh\(\)\)/);
    expect(fastTravelSource).not.toMatch(/group\.add\(fillMesh\)/);
  });
});
