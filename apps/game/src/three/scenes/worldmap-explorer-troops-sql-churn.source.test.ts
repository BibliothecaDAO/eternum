// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorldmap = () => readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");
const readManager = () => readFileSync(resolve(process.cwd(), "src/three/managers/army-manager.ts"), "utf8");

describe("worldmap army projection hydration", () => {
  it("does not schedule camera-driven ExplorerTroops hydration", () => {
    const source = readWorldmap();

    expect(source).not.toContain("getExplorerTroopsRenderAreaKeyForChunk");
    expect(source).not.toContain("getExplorerTroopsFetchBoundsForArea");
    expect(source).not.toContain("EXPLORER_TROOPS_HYDRATION_KEY_PREFIX");
    expect(source).not.toContain('stages: ["explorerTroops"]');
  });

  it("selects bounded render resources from the always-current projection", () => {
    const source = readManager();

    expect(source).toContain("this.worldSpatialProjection.getArmiesInBounds");
    expect(source).not.toContain("getExplorerTroopsFromToriiExact(");
  });
});
