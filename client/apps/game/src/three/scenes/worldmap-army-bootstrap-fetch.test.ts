import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap army bootstrap fetch", () => {
  it("hydrates explorer troops snapshots during exact chunk bootstrap before tile replay", () => {
    const source = readWorldmapSource();

    expect(source).toContain("getExplorerTroopsFromToriiExact");

    const methodStart = source.indexOf("private async executeTileEntitiesFetch(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 1800);
    const explorerFetchIndex = methodBody.indexOf("getExplorerTroopsFromToriiExact(");
    const tileFetchIndex = methodBody.indexOf("getMapFromToriiExact(");

    expect(explorerFetchIndex).toBeGreaterThan(-1);
    expect(tileFetchIndex).toBeGreaterThan(-1);
    expect(explorerFetchIndex).toBeLessThan(tileFetchIndex);
  });
});
