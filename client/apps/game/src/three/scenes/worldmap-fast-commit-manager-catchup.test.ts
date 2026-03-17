import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap fast commit manager catch-up wiring", () => {
  it("defers switch manager catch-up instead of awaiting it in the finalize path", () => {
    const finalizeSource = readSceneSource("./warp-travel-chunk-switch-commit.ts");

    expect(finalizeSource).toMatch(/scheduleManagerCatchUp\(/);
    expect(finalizeSource).not.toMatch(/await input\.updateManagersForChunk\(/);
  });

  it("defers same-chunk refresh manager catch-up after terrain commit", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/deferManagerCatchUpForChunk\(/);
    expect(worldmapSource).not.toMatch(/await this\.updateManagersForChunk\(chunkKey, \{ force: true, transitionToken \}\)/);
  });
});
