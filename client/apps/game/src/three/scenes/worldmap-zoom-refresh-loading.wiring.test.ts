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

describe("worldmap zoom refresh loading wiring", () => {
  it("marks zoom-driven chunk refresh requests to show map loading", () => {
    const source = readWorldmapSource();
    const controlsChangeSource = extractMethod(
      source,
      "  private handleWorldmapControlsChange = () => {",
      "  private isUrlChangedListenerAttached = false;",
    );

    expect(controlsChangeSource).toMatch(
      /this\.requestChunkRefresh\(refreshPlan\.immediateLevel === "forced",\s*"default",\s*\{\s*showMapLoading:\s*true\s*,?\s*\}\)/,
    );
  });

  it("runs both refresh execution paths through the shared map loading wrapper", () => {
    const source = readWorldmapSource();
    const legacyRefreshSource = extractMethod(
      source,
      "  private scheduleLegacyChunkRefresh(",
      "  private scheduleChunkRefreshExecution(",
    );
    const flushRefreshSource = extractMethod(
      source,
      "  private async flushChunkRefresh(",
      "  async updateVisibleChunks(",
    );

    expect(source).toMatch(/private async runChunkRefreshWithMapLoading\(/);
    expect(legacyRefreshSource).toMatch(/this\.runChunkRefreshWithMapLoading\(/);
    expect(flushRefreshSource).toMatch(/await this\.runChunkRefreshWithMapLoading\(/);
  });
});
