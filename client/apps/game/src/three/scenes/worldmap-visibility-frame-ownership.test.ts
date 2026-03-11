import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readThreeSource(relativePathFromThreeRoot: string): string {
  const scenesDir = dirname(fileURLToPath(import.meta.url));
  const threeRoot = resolve(scenesDir, "..");
  const filePath = resolve(threeRoot, relativePathFromThreeRoot);
  return readFileSync(filePath, "utf8");
}

function countBeginFrameCalls(source: string): number {
  return [...source.matchAll(/beginFrame\s*\(/g)].length;
}

describe("visibility frame ownership", () => {
  it("keeps scene update loop as the sole beginFrame owner", () => {
    const hexagonSceneSource = readThreeSource("scenes/hexagon-scene.ts");
    const armyManagerSource = readThreeSource("managers/army-manager.ts");
    const structureManagerSource = readThreeSource("managers/structure-manager.ts");
    const chestManagerSource = readThreeSource("managers/chest-manager.ts");

    expect(countBeginFrameCalls(hexagonSceneSource)).toBe(1);
    expect(countBeginFrameCalls(armyManagerSource)).toBe(0);
    expect(countBeginFrameCalls(structureManagerSource)).toBe(0);
    expect(countBeginFrameCalls(chestManagerSource)).toBe(0);
  });
});
