import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene chunk loading controls wiring", () => {
  it("tracks the current chunk and debounces camera-driven refresh requests", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/private currentChunk: string = "null"/);
    expect(source).toMatch(/private chunkRefreshTimeout: number \| null = null/);
    expect(source).toMatch(/private readonly chunkRefreshDebounceMs = FAST_TRAVEL_CHUNK_POLICY\.refreshDebounceMs/);
    expect(source).toMatch(/private requestChunkRefresh\(force: boolean = false\): void/);
    expect(source).toMatch(/window\.setTimeout/);
    expect(source).toMatch(/void this\.updateVisibleChunks\(shouldForce\)/);
  });

  it("registers an idempotent controls-change handler for fast travel and refreshes through updateVisibleChunks", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/private handleFastTravelControlsChange = \(\): void =>/);
    expect(source).toMatch(/this\.sceneManager\.getCurrentScene\(\) !== SceneName\.FastTravel/);
    expect(source).toMatch(/this\.controls\.addEventListener\("change", this\.handleFastTravelControlsChange\)/);
    expect(source).toMatch(/this\.controls\.removeEventListener\("change", this\.handleFastTravelControlsChange\)/);
    expect(source).toMatch(/private async refreshFastTravelScene\(\): Promise<void>/);
    expect(source).toMatch(/await this\.updateVisibleChunks\(true\)/);
  });
});
