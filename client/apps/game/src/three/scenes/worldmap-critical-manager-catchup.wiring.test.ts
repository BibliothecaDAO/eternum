import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap critical manager catch-up wiring", () => {
  it("uses Promise.allSettled and schedules one visibility recovery through the shared chunk recovery path", () => {
    const worldmapSource = readSceneSource("./worldmap.tsx");

    expect(worldmapSource).toMatch(/private async updateCriticalManagersForChunk\(/);
    expect(worldmapSource).toMatch(/Promise\.allSettled\(\[/);
    expect(worldmapSource).toMatch(/critical_manager_catch_up_failed/);
    expect(worldmapSource).toMatch(/scheduleChunkRecoveryWithReason\(/);
    expect(worldmapSource).toMatch(/"visibility_recovery"/);
  });
});
