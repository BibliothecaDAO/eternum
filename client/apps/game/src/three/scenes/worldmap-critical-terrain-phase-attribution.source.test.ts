// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("worldmap critical terrain phase attribution", () => {
  it("measures CPU build and commit inside their queued units, separately from model wait", () => {
    const source = readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
    const prepareStart = source.indexOf("private async prepareVisualTerrainPage(");
    const prepareEnd = source.indexOf("private async awaitPreparedTerrainBiomeModels(", prepareStart);
    const prepareMethod = source.slice(prepareStart, prepareEnd);
    const buildStart = prepareMethod.indexOf("const buildStartedAt = performance.now()");
    const modelWaitStart = prepareMethod.indexOf("const modelWaitStartedAt = performance.now()");

    expect(prepareMethod).toContain("this.chunkWorkQueue.schedule(workLane");
    expect(buildStart).toBeGreaterThan(prepareMethod.indexOf("this.chunkWorkQueue.schedule(workLane"));
    expect(modelWaitStart).toBeGreaterThan(prepareMethod.indexOf("await this.chunkWorkQueue.schedule"));
    expect(prepareMethod).toContain("modelWaitMs: performance.now() - modelWaitStartedAt");

    const buildAndApplyStart = source.indexOf("private async buildAndApplyVisualTerrainPage(");
    const buildAndApplyEnd = source.indexOf("private reportCriticalVisualTerrainPagePhases(", buildAndApplyStart);
    const buildAndApplyMethod = source.slice(buildAndApplyStart, buildAndApplyEnd);
    expect(buildAndApplyMethod).toContain("const commitStartedAt = performance.now()");
    expect(buildAndApplyMethod).toContain("commitTimings.commitMs = performance.now() - commitStartedAt");
  });
});
