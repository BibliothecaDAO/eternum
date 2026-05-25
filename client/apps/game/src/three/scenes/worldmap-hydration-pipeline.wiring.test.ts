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

describe("worldmap hydration pipeline wiring", () => {
  it("routes chunk switch and refresh hydration through the shared scene helper", () => {
    const source = readWorldmapSource();
    const performChunkSwitchSource = extractMethod(
      source,
      "  private async performChunkSwitch(",
      "  private async refreshCurrentChunk(",
    );
    const refreshCurrentChunkSource = extractMethod(
      source,
      "  private async refreshCurrentChunk(",
      "  private async updateManagersForChunk(",
    );

    expect(source).toMatch(/private hydrateChunkForPresentation\(/);
    expect(performChunkSwitchSource).toMatch(/await this\.hydrateChunkForPresentation\(\{/);
    expect(refreshCurrentChunkSource).toMatch(/hydrateChunk: \(\) =>\s*this\.hydrateChunkForPresentation\(\{/);
  });

  it("reuses shared terrain-ready bookkeeping for both switches and refreshes", () => {
    const source = readWorldmapSource();
    const performChunkSwitchSource = extractMethod(
      source,
      "  private async performChunkSwitch(",
      "  private async refreshCurrentChunk(",
    );
    const refreshCurrentChunkSource = extractMethod(
      source,
      "  private async refreshCurrentChunk(",
      "  private async updateManagersForChunk(",
    );

    expect(source).toMatch(/private recordPreparedTerrainReady\(/);
    expect(performChunkSwitchSource).toMatch(/this\.recordPreparedTerrainReady\(chunkSwitchStartedAt/);
    expect(refreshCurrentChunkSource).toMatch(/this\.recordPreparedTerrainReady\(refreshStartedAt/);
  });
});
