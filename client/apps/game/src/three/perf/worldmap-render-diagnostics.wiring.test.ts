import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "..", relativePath), "utf8");
}

describe("worldmap render diagnostics wiring", () => {
  it("instruments the targeted PRD render hot paths", () => {
    const worldmapSource = readSource("scenes/worldmap.tsx");
    const armyManagerSource = readSource("managers/army-manager.ts");
    const structureManagerSource = readSource("managers/structure-manager.ts");
    const workerManagerSource = readSource("../managers/game-worker-manager.ts");
    const pathRendererSource = readSource("managers/path-renderer.ts");
    const hexagonSceneSource = readSource("scenes/hexagon-scene.ts");

    expect(worldmapSource).toMatch(/recordWorldmapRenderDuration\("updateVisibleChunks"/);
    expect(worldmapSource).toMatch(/recordWorldmapRenderDuration\("performChunkSwitch"/);
    expect(worldmapSource).toMatch(/recordWorldmapRenderDuration\("updateManagersForChunk"/);
    expect(worldmapSource).toMatch(/incrementWorldmapRenderCounter\("chunkRefreshRequests"/);
    expect(worldmapSource).toMatch(/incrementWorldmapRenderCounter\("updateVisibleChunksCalls"/);
    expect(worldmapSource).toMatch(/incrementWorldmapRenderUploadBytes\("cachedChunkReplay"/);
    expect(armyManagerSource).toMatch(/recordWorldmapRenderDuration\("executeRenderForChunk"/);
    expect(structureManagerSource).toMatch(/recordWorldmapRenderDuration\("performVisibleStructuresUpdate"/);
    expect(workerManagerSource).toMatch(/recordWorldmapRenderDuration\("workerFindPath"/);
    expect(pathRendererSource).toMatch(/recordWorldmapRenderDuration\("createPath"/);
    expect(hexagonSceneSource).toMatch(/incrementWorldmapRenderCounter\("controlsChangeEvents"/);
    expect(hexagonSceneSource).toMatch(/incrementWorldmapRenderCounter\("zoomTransitionsStarted"/);
  });
});
