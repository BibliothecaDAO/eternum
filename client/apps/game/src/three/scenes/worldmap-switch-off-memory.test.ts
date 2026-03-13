import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("worldmap switch-off memory shedding", () => {
  it("passes the destination scene into switch-off and sheds caches for fast travel", () => {
    const sceneManagerSource = readSceneSource("../scene-manager.ts");
    const worldmapSource = readSceneSource("worldmap.tsx");

    expect(sceneManagerSource).toMatch(/previousScene\?\.onSwitchOff\(sceneNameToTransition\)/);
    expect(worldmapSource).toMatch(/onSwitchOff\(nextSceneName\?: SceneName\)/);
    expect(worldmapSource).toMatch(/nextSceneName: nextSceneName/);
    expect(worldmapSource).toMatch(/releaseInactiveResources: \(\) => this\.clearCache\(\)/);
  });
});
