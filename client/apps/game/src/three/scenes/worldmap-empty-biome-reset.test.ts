import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readWorldmapSource(): string {
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap Empty biome reset wiring", () => {
  it("tracks Empty in the terrain rebuild map so stale instances are cleared on commit", () => {
    const source = readWorldmapSource();
    expect(source).toMatch(/const biomeHexes:[\s\S]*Empty:\s*\[\],/);
  });
});
