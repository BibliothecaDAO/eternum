// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Worldmap critical terrain preparation", () => {
  it("has no whole-tile biome model wait", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");
    const prepareStart = source.indexOf("private async prepareVisualTerrainPage(");
    const prepareEnd = source.indexOf("private buildPreparedTerrainArea(", prepareStart);
    const prepareBody = source.slice(prepareStart, prepareEnd);

    expect(prepareBody).not.toContain("Promise.all(this.modelLoadPromises)");
    expect(prepareBody).not.toContain("awaitPreparedTerrainBiomeModels");
    expect(prepareBody).toContain("modelWaitMs: 0");
    expect(source).not.toContain("biomeModelLoadPromises");
    expect(source).not.toContain("loadBiomeModels");
  });
});
