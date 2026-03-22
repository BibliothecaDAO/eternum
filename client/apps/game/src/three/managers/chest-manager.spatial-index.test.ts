import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readChestManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, "chest-manager.ts");
  return readFileSync(filePath, "utf8");
}

describe("ChestManager spatial index", () => {
  it("uses bucketed chest lookups instead of filtering every chest on each chunk render", () => {
    const source = readChestManagerSource();

    expect(source).toMatch(/chunkToChests/);
    expect(source).not.toMatch(/Array\.from\(chests\.values\(\)\)\s*\.filter/);
  });
});
