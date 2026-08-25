import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap fast commit manager catch-up wiring", () => {
  it("routes staged switch commits through immediate critical catch-up and deferred non-critical catch-up", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/updateCriticalManagersForChunk\(/);
    expect(worldmapSource).toMatch(/deferNonCriticalManagerCatchUpForCommittedChunk\(/);
    expect(worldmapSource).toMatch(/WORLDMAP_STREAMING_ROLLOUT\.stagedPathEnabled/);
  });

  it("keeps same-chunk refresh critical catch-up immediate after terrain commit", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/runImmediateCriticalManagerCatchUp:/);
    expect(worldmapSource).toMatch(/scheduleDeferredNonCriticalManagerCatchUp:/);
    expect(worldmapSource).not.toMatch(/scheduleDeferredManagerCatchUp:/);
    expect(worldmapSource).toMatch(/WORLDMAP_STREAMING_ROLLOUT\.stagedPathEnabled/);
  });
});
