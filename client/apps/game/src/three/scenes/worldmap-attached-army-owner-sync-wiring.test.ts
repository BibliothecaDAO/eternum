import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap attached-army owner sync wiring", () => {
  it("propagates structure owner updates to attached armies", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/private\s+syncAttachedArmiesForStructureOwner\s*\(/);
    expect(source).toMatch(/this\.syncAttachedArmiesForStructureOwner\s*\(\s*update\s*\)/);
  });
});
