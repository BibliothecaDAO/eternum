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

describe("worldmap terrain cache single write", () => {
  it("does not speculatively cache prepared terrain inside performChunkSwitch", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  private async performChunkSwitch(",
      "  private async refreshCurrentChunk(",
    );

    expect(methodSource).not.toMatch(
      /const preparedChunk = await this\.prepareTerrainChunk[\s\S]*?this\.cachePreparedTerrainChunk\(preparedChunk\);/s,
    );
  });

  it("does not speculatively cache prepared terrain inside refreshCurrentChunk", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  private async refreshCurrentChunk(",
      "  private async updateManagersForChunk(",
    );

    expect(methodSource).not.toMatch(
      /const preparedChunk = await this\.prepareTerrainChunk[\s\S]*?this\.cachePreparedTerrainChunk\(preparedChunk\);/s,
    );
  });

  it("keeps the authoritative cache write inside applyPreparedTerrainChunk", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  private applyPreparedTerrainChunk(preparedTerrain: PreparedTerrainChunk): void {",
      "  private updatePinnedChunks(",
    );

    expect(methodSource).toMatch(/this\.cachePreparedTerrainChunk\(preparedTerrain\);/);
  });
});
