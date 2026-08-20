import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readWorldmapSource(): string {
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function readRendererSceneBootstrapSource(): string {
  return readFileSync(resolve(currentDir, "../renderer-scene-bootstrap.ts"), "utf8");
}

function extractSourceBetween(source: string, startSignature: string, endSignature: string): string {
  const start = source.indexOf(startSignature);
  const end = source.indexOf(endSignature, start + startSignature.length);
  if (start === -1 || end === -1) {
    return "";
  }

  return source.slice(start, end);
}

describe("worldmap hover label wiring", () => {
  it("reconciles current hover only after entity managers catch up", () => {
    const source = readWorldmapSource();

    const projectionLifecycle = extractSourceBetween(
      source,
      "private bindWorldSpatialProjectionLifecycle()",
      "private bindWorldmapCameraViewLifecycle()",
    );
    const armyChanges = extractSourceBetween(
      source,
      "private handleProjectedArmyChanges(",
      "private syncProjectedStructurePathfinding(",
    );

    expect(projectionLifecycle).toContain("this.handleProjectedArmyChanges(changes)");
    expect(armyChanges).toContain("this.reconcileHoverLabels()");
    expect(source).not.toContain("public updateArmyHexes(");
  });

  it("resolves hover labels with direct army raycast fallback", () => {
    const source = readWorldmapSource();

    expect(source).toContain("resolveWorldmapHoverLabelTargets");
    expect(source).toContain("resolveRaycastArmyHoverTarget");
  });

  it("passes markLabelsDirty into WorldmapScene construction", () => {
    const source = readRendererSceneBootstrapSource();

    expect(source).toContain("markLabelsDirty");
    expect(source).toMatch(/new WorldmapScene\([\s\S]*markLabelsDirty/);
  });

  it("does not reattach every tracked manager label on scene resume", () => {
    const source = readWorldmapSource();
    const attachWorldmapManagerLabels = extractSourceBetween(
      source,
      "private attachWorldmapManagerLabels()",
      "private detachWorldmapManagerLabels()",
    );

    expect(attachWorldmapManagerLabels).toContain("this.reconcileHoverLabels()");
    expect(attachWorldmapManagerLabels).not.toContain("addLabelsToScene");
    expect(attachWorldmapManagerLabels).not.toContain("showLabels()");
  });

  it("reconciles current hover after initial chunk refresh convergence", () => {
    const source = readWorldmapSource();
    const convergenceOwner = extractSourceBetween(
      source,
      "private announceWorldmapConverged(",
      "private prepareWarpTravelInitialSetup()",
    );

    const convergencePos = convergenceOwner.indexOf("markWorldmapConverged(bootToken)");
    const reconcilePos = convergenceOwner.indexOf('this.reconcileHoverLabels("initial_refresh")');

    expect(convergencePos).toBeGreaterThan(-1);
    expect(reconcilePos).toBeGreaterThan(-1);
    expect(reconcilePos).toBeGreaterThan(convergencePos);
  });

  it("routes hover reconciliation through pending recovery state", () => {
    const source = readWorldmapSource();
    const reconcileHoverLabels = extractSourceBetween(
      source,
      "private reconcileHoverLabels(",
      "protected tryArmyRaycastFallback(",
    );

    expect(source).toContain("pendingHoverLabelRecovery");
    expect(reconcileHoverLabels).toContain("this.applyHoverLabelRecoveryResult(");
    expect(source).toContain("this.runPendingHoverLabelRecoveryFrame()");
  });

  it("retries pending hover labels after readiness events", () => {
    const source = readWorldmapSource();

    expect(
      extractSourceBetween(source, "private announceWorldmapSceneReady(", "private announceWorldmapConverged("),
    ).toContain("this.retryPendingHoverLabelRecovery");
    expect(
      extractSourceBetween(
        source,
        "private async updateCriticalManagersForChunk(",
        "private async updateNonCriticalManagersForChunk(",
      ),
    ).toContain("this.retryPendingHoverLabelRecovery");
    expect(
      extractSourceBetween(
        source,
        "private async updateNonCriticalManagersForChunk(",
        "private syncArrivalGhostChunkVisibility()",
      ),
    ).toContain("this.retryPendingHoverLabelRecovery");
  });

  it("clears active hover state before detaching manager labels", () => {
    const source = readWorldmapSource();
    const detachWorldmapManagerLabels = extractSourceBetween(
      source,
      "private detachWorldmapManagerLabels()",
      "private async refreshWarpTravelScene(",
    );

    expect(detachWorldmapManagerLabels).toContain("this.hoverLabelManager.onHexLeave()");
    expect(detachWorldmapManagerLabels.indexOf("this.hoverLabelManager.onHexLeave()")).toBeLessThan(
      detachWorldmapManagerLabels.indexOf("this.armyManager.removeLabelsFromScene()"),
    );
  });

  it("skips stationary hex reconciliation while the hover mode is unchanged", () => {
    const onHexagonMouseMove = extractSourceBetween(
      readWorldmapSource(),
      "protected onHexagonMouseMove(",
      "protected onHexagonDoubleClick(",
    );

    const stableHoverGuard = onHexagonMouseMove.indexOf("shouldReconcileWorldmapHover(");
    expect(stableHoverGuard).toBeGreaterThan(-1);
    expect(stableHoverGuard).toBeLessThan(onHexagonMouseMove.indexOf('this.reconcileHoverLabels("hover")'));
    expect(onHexagonMouseMove.indexOf("this.previouslyHoveredHex = hexCoords")).toBeLessThan(
      onHexagonMouseMove.indexOf("const { selectedEntityId, actionPaths }"),
    );
  });

  it("clears pending hover recovery when hover or scene lifecycle ends", () => {
    const source = readWorldmapSource();
    const onHexagonMouseMove = extractSourceBetween(
      source,
      "protected onHexagonMouseMove(",
      "protected onHexagonDoubleClick(",
    );
    const resetWorldmapInteractionForSwitchOff = extractSourceBetween(
      source,
      "private resetWorldmapInteractionForSwitchOff(",
      "private clearWorldmapVisibilityRuntimeForSwitchOff()",
    );

    expect(onHexagonMouseMove).toContain('this.clearPendingHoverLabelRecovery("hex_leave")');
    expect(resetWorldmapInteractionForSwitchOff).toContain("this.currentHoverLabelHex = null");
    expect(resetWorldmapInteractionForSwitchOff).toContain('this.clearPendingHoverLabelRecovery("switch_off")');
  });
});
