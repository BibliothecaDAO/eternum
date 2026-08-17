// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Worldmap critical terrain model loading", () => {
  it("waits only for biome models used by the prepared page", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");
    const prepareStart = source.indexOf("private async prepareVisualTerrainPage(");
    const prepareEnd = source.indexOf("private buildPreparedTerrainArea(", prepareStart);
    const prepareBody = source.slice(prepareStart, prepareEnd);

    expect(prepareBody).not.toContain("Promise.all(this.modelLoadPromises)");
    expect(prepareBody).toContain(
      "const preparedTerrainWithModels = await this.awaitPreparedTerrainBiomeModels(preparedTerrain)",
    );
    expect(prepareBody).toContain("modelWaitMs: performance.now() - modelWaitStartedAt");
    expect(prepareBody).toMatch(/entry\.count === 0[\s\S]*this\.biomeModelLoadPromises\.get\(biomeKey\)/);
  });
});
