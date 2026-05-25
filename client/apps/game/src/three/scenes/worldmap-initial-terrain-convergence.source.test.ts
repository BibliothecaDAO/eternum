// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap initial terrain convergence", () => {
  it("awaits terrain convergence after the first visible refresh before scene readiness can be announced", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const refreshStart = source.indexOf("private async refreshWarpTravelScene()");
    const refreshEnd = source.indexOf("private commitCurrentChunkAuthority(", refreshStart);

    expect(refreshStart).toBeGreaterThanOrEqual(0);
    expect(refreshEnd).toBeGreaterThan(refreshStart);

    const refreshBody = source.slice(refreshStart, refreshEnd);
    const didRefreshGuardIndex = refreshBody.indexOf(
      'throw new Error("World map did not finish its initial interactive refresh.")',
    );
    const convergenceIndex = refreshBody.indexOf("await this.awaitInitialTerrainConvergence();");
    const hoverReconcileIndex = refreshBody.indexOf('this.reconcileHoverLabels("initial_refresh");');

    expect(didRefreshGuardIndex).toBeGreaterThanOrEqual(0);
    expect(convergenceIndex).toBeGreaterThan(didRefreshGuardIndex);
    expect(hoverReconcileIndex).toBeGreaterThan(convergenceIndex);
  });

  it("tracks legacy chunk refresh execution so initial convergence waits for the actual refresh", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const scheduleStart = source.indexOf("private scheduleLegacyChunkRefresh(");
    const flushStart = source.indexOf("private async flushLegacyChunkRefresh(", scheduleStart);
    const flushEnd = source.indexOf("private scheduleChunkRefreshExecution(", flushStart);

    expect(scheduleStart).toBeGreaterThanOrEqual(0);
    expect(flushStart).toBeGreaterThan(scheduleStart);
    expect(flushEnd).toBeGreaterThan(flushStart);

    const scheduleBody = source.slice(scheduleStart, flushStart);
    const flushBody = source.slice(flushStart, flushEnd);

    expect(scheduleBody).toContain("const scheduledToken = this.chunkRefreshRequestToken");
    expect(scheduleBody).toContain("void this.flushLegacyChunkRefresh(scheduledToken)");
    expect(flushBody).toContain("runWorldmapChunkRefreshExecution");
    expect(flushBody).toContain("state: this.chunkRefreshRuntimeState");
  });

  it("does not schedule hover recovery when a hovered tile resolves no entity", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("private applyHoverLabelRecoveryResult(");
    const methodEnd = source.indexOf("private retryPendingHoverLabelRecovery(", methodStart);

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);

    expect(methodBody).toContain("!result.resolvedAnyEntity");
    expect(methodBody).toContain('this.clearPendingHoverLabelRecovery("no_entity")');
  });
});
