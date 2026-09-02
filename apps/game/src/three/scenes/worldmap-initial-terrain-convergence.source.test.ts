// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap initial terrain convergence", () => {
  it("delegates critical readiness and later terrain convergence to the entry owner", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const refreshStart = source.indexOf("private async refreshWarpTravelScene(");
    const refreshEnd = source.indexOf("private commitCurrentChunkAuthority(", refreshStart);

    expect(refreshStart).toBeGreaterThanOrEqual(0);
    expect(refreshEnd).toBeGreaterThan(refreshStart);

    const refreshBody = source.slice(refreshStart, refreshEnd);
    const readinessIndex = refreshBody.indexOf("await startWorldmapEntryReadiness({");
    const criticalPassIndex = refreshBody.indexOf("commitCriticalPass:");
    const ambientRequirementIndex = refreshBody.indexOf("requiresAmbientConvergence,");
    const convergenceIndex = refreshBody.indexOf("waitForAmbientConvergence:");
    expect(readinessIndex).toBeGreaterThanOrEqual(0);
    expect(criticalPassIndex).toBeGreaterThan(readinessIndex);
    expect(ambientRequirementIndex).toBeGreaterThan(criticalPassIndex);
    expect(convergenceIndex).toBeGreaterThan(criticalPassIndex);

    const convergenceOwnerStart = source.indexOf("private announceWorldmapConverged(");
    const convergenceOwnerEnd = source.indexOf("private prepareWarpTravelInitialSetup(", convergenceOwnerStart);
    const convergenceOwner = source.slice(convergenceOwnerStart, convergenceOwnerEnd);

    expect(convergenceOwner).toContain("markWorldmapConverged(bootToken)");
    expect(convergenceOwner).not.toContain("skipNextInitialSetupUrlRefresh");
    expect(convergenceOwner).toContain('this.reconcileHoverLabels("initial_refresh")');
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

  // The recovery-result apply moved to the WorldmapHoverLabelRecovery collaborator; the same discipline
  // (a hovered tile that resolves no entity clears the pending retry rather than scheduling one) holds there.
  it("does not schedule hover recovery when a hovered tile resolves no entity", () => {
    const source = readSource("src/three/scenes/worldmap-hover-label-recovery.ts");
    const methodStart = source.indexOf("private applyResult(");
    const methodEnd = source.indexOf("private isPendingForHex(", methodStart);

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);

    expect(methodBody).toContain("!result.resolvedAnyEntity");
    expect(methodBody).toContain('this.clear("no_entity")');
  });
});
