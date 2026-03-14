import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readHexagonSceneSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "hexagon-scene.ts"), "utf8");
}

describe("worldmap view resolution policy wiring", () => {
  it("derives semantic view from camera distance instead of assigning the target view directly", () => {
    const source = readHexagonSceneSource();

    expect(source).toMatch(/resolveWorldmapViewFromDistance\(/);
    expect(source).not.toMatch(/this\.currentCameraView = position;/);
  });
});
