// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("worldmap critical terrain phase attribution", () => {
  it("measures CPU build and commit inside their queued units with no model wait", () => {
    const source = readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
    const prepareStart = source.indexOf("private async prepareVisualTerrainPage(");
    const prepareEnd = source.indexOf("private buildPreparedTerrainArea(", prepareStart);
    const prepareMethod = source.slice(prepareStart, prepareEnd);
    const queuedBuildStart = prepareMethod.indexOf("this.chunkWorkQueue.schedule(");
    const buildStart = prepareMethod.indexOf("const buildStartedAt = performance.now()");

    expect(queuedBuildStart).toBeGreaterThanOrEqual(0);
    expect(buildStart).toBeGreaterThan(queuedBuildStart);
    expect(prepareMethod).toContain("`terrain:${workLane}-page-build`");
    expect(prepareMethod).toContain("modelWaitMs: 0");
    expect(prepareMethod).not.toContain("modelWaitStartedAt");

    const buildAndApplyStart = source.indexOf("private async buildAndApplyVisualTerrainPage(");
    const buildAndApplyEnd = source.indexOf("private reportCriticalVisualTerrainPagePhases(", buildAndApplyStart);
    const buildAndApplyMethod = source.slice(buildAndApplyStart, buildAndApplyEnd);
    expect(buildAndApplyMethod).toContain("const commitStartedAt = performance.now()");
    expect(buildAndApplyMethod).toContain("commitTimings.commitMs = performance.now() - commitStartedAt");
  });
});
