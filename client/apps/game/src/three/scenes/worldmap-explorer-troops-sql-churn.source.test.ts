// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorldmap = () => readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");

describe("worldmap sparse global spatial hydration", () => {
  it("keeps sparse army hydration separate while structure membership stays projection-owned", () => {
    const source = readWorldmap();

    expect(source).toContain("private getExplorerTroopsRenderAreaKeyForChunk(");
    expect(source).toContain("private getExplorerTroopsFetchBoundsForArea(");
    expect(source).toContain("EXPLORER_TROOPS_HYDRATION_KEY_PREFIX");
    expect(source).toContain("WORLDMAP_CHUNK_POLICY.toriiFetch.explorerTroopsSuperAreaStrides");
    expect(source).not.toContain("STRUCTURES_HYDRATION_KEY_PREFIX");
    expect(source).not.toContain("getStructuresRenderAreaKeyForChunk");
    expect(source).not.toContain('stages: ["structures"]');
    expect(source).not.toContain("waitForStructureHydrationIdle");
  });

  it("does not restore exact SQL fallbacks in the presentation path", () => {
    const source = readWorldmap();

    expect(source).not.toContain("getExplorerTroopsFromToriiExact(");
    expect(source).not.toContain("getStructuresFromToriiExact(");
    expect(source).not.toContain("resolveStructureTileUpdateFromTileOpt");
  });
});
