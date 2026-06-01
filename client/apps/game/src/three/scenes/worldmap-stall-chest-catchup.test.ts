import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractMethod(source: string, signature: string, nextSignature: string): string {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  return source.slice(start, end);
}

describe("worldmap stall recovery forces a chest catch-up", () => {
  it("schedules a forced non-critical (chest) catch-up after stall recovery", () => {
    const method = extractMethod(
      readWorldmapSource(),
      "  private recoverChunkManagersAfterStall(chunkKey: string, transitionToken: number): void {",
      "  private handleChunkPresentationTimeout(",
    );

    // Stall recovery commits the chest manager's currentChunk without rendering;
    // a forced catch-up is required so the skip-guard cannot strand chest models.
    expect(method).toMatch(/this\.chestManager\.recoverChunkUpdateAfterStall\(recoveryInput\);/);
    expect(method).toMatch(
      /this\.deferNonCriticalManagerCatchUpForChunk\(chunkKey, \{[\s\S]*?force: true,[\s\S]*?\}\);/s,
    );
  });
});
