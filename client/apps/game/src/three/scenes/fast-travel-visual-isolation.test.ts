import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene visual isolation", () => {
  it("opts out of shared storm and day-night background mutation", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/shouldEnableStormEffects\(\): boolean/);
    expect(source).toMatch(/shouldEnableStormEffects\(\): boolean\s*{\s*return false;\s*}/);
  });

  it("keeps black as the authoritative fast-travel backdrop", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/configureFastTravelSetupStart\(\): void/);
    expect(source).toMatch(/this\.scene\.background = new Color\("#000000"\)/);
    expect(source).toMatch(/this\.scene\.fog = null/);
  });
});
