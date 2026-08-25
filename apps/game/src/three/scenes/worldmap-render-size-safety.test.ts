import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, fileName);
  return readFileSync(filePath, "utf8");
}

describe("worldmap render-size safety", () => {
  it("does not allow worldmap perf simulation to mutate render chunk size at runtime", () => {
    const worldmapSource = readSceneSource("worldmap.tsx");
    expect(worldmapSource).not.toMatch(/setRenderChunkSize\s*:/);
  });

  it("keeps perf simulation render size control read-only", () => {
    const perfSimulationSource = readSceneSource("worldmap-perf-simulation.ts");

    expect(perfSimulationSource).not.toMatch(/\.name\("Render Size"\)\s*\.onChange/);
    expect(perfSimulationSource).not.toMatch(/this\.setRenderChunkSize\(/);
  });
});
