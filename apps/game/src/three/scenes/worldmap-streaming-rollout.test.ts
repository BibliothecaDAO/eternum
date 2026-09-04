import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap streaming rollout wiring", () => {
  it("keeps a top-level rollout flag for the staged streaming path", () => {
    const source = readSceneSource("./worldmap.tsx");

    expect(source).toMatch(/VITE_PUBLIC_WORLDMAP_STREAMING_STAGED/);
    expect(source).toMatch(/WORLDMAP_STREAMING_ROLLOUT/);
  });

  it("clears pending streaming work on switch-off and preserves a legacy manager catch-up fallback", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");
    const lifecycleSource = readSceneSource("./worldmap-runtime-lifecycle.ts");

    expect(lifecycleSource).toMatch(/clearStreamingWork/);
    expect(worldmapSource).toMatch(/clearStreamingWorkState\(/);
    expect(worldmapSource).toMatch(/managerCatchUpPromise/);
  });
});
