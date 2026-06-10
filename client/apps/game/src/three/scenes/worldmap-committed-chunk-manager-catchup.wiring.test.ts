import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap committed chunk manager catch-up wiring", () => {
  it("prioritizes critical catch-up before deferring the staged fanout", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/catchUpCommittedWorldmapChunkManagers\(\{/);
    expect(worldmapSource).toMatch(/runImmediateCriticalManagerCatchUp: \(\) => this\.updateCriticalManagersForChunk/);
    expect(worldmapSource).toMatch(/scheduleDeferredNonCriticalManagerCatchUp: \(\) =>/);
    expect(worldmapSource).toMatch(
      /this\.deferNonCriticalManagerCatchUpForCommittedChunk\(targetChunkKey, managerOptions\)/,
    );
  });
});
