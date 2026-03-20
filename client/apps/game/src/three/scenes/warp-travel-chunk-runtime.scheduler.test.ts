import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("warp-travel chunk runtime scheduler wiring", () => {
  it("routes worldmap chunk switching through hysteresis and explicit refresh debounce policies", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/resolveWorldmapChunkHysteresis\(/);
    expect(worldmapSource).toMatch(/resolveWorldmapChunkRefreshDebounceMs\(/);
    expect(worldmapSource).toMatch(/resolveWorldmapChunkRefreshSchedule\(/);
  });
});
