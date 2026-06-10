import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap critical manager catch-up wiring", () => {
  it("bounds critical manager catch-up and schedules one manager recovery refresh", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/private async updateCriticalManagersForChunk\(/);
    expect(worldmapSource).toMatch(/runWorldmapCriticalManagerCatchUp\(\{/);
    expect(worldmapSource).toMatch(/recoverChunkUpdateAfterStall\(criticalManagerRecovery\.resolveRecoveryInput\(\)\)/);
    expect(worldmapSource).toMatch(/critical_manager_catch_up_failed/);
    expect(worldmapSource).toMatch(/refreshReason: "manager_recovery"/);
  });
});
