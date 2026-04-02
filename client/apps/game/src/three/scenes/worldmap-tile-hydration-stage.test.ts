import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap tile hydration stage split", () => {
  it("routes explored-tile updates through authoritative mutation before scheduling visible reconcile", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(
      /public async updateExploredHex\(update: TileSystemUpdate\) \{[\s\S]*?const authoritativeResult = this\.applyExploredTileUpdateToAuthoritativeState\(update\);[\s\S]*?if \(!authoritativeResult\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?void this\.reconcileVisibleExploredTile\(authoritativeResult\);[\s\S]*?\}/,
    );
  });
});
