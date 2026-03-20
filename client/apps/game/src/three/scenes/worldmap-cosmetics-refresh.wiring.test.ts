import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readWorldmapSource = (): string => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
};

describe("worldmap cosmetics refresh wiring", () => {
  it("subscribes to cosmetic store updates and disposes the subscription on destroy", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/this\.cosmeticsSubscriptionCleanup\s*=\s*playerCosmeticsStore\.subscribe/);
    expect(source).toMatch(/this\.armyManager\.refreshCosmeticsForOwner\(owner\)/);
    expect(source).toMatch(/this\.structureManager\.refreshCosmeticsForOwner\(owner\)/);
    expect(source).toMatch(/this\.cosmeticsSubscriptionCleanup\?\.\(\)/);
  });
});
