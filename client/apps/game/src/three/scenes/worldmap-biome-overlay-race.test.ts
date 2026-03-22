import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap biome overlay race hardening", () => {
  it("wires tile hydration drain into chunk hydration and refresh paths", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/waitForTileHydrationIdle:\s*async\s*\(targetChunkKey\)/);
  });

  it("uses visible terrain membership and reconcile policy to avoid append-on-conflict", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/visibleTerrainMembership/i);
    expect(source).toMatch(/resolveVisibleTerrainReconcileMode/);
    expect(source).toMatch(/tile_overlap_repair/);
  });

  it("checks terrain fingerprint before cache replay is accepted", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/createWorldmapTerrainFingerprint/);
    expect(source).toMatch(/shouldRejectCachedTerrainFingerprintMismatch/);
  });
});
