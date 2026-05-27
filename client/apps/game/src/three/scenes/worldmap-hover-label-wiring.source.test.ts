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

    expect(
      extractSourceBetween(
        source,
        "await this.armyManager.onTileUpdate(update)",
        "this.clearPendingArmyMovementFromAuthoritativePosition(update)",
      ),
    ).toContain("this.reconcileHoverLabels()");
    expect(extractSourceBetween(source, "processExplorerTroopsUpdate(update", "}),")).toContain("reconcileHoverLabels");
    expect(extractSourceBetween(source, "await this.trackStructureHydrationUpdate(value", "const newCount")).toContain(
      "this.reconcileHoverLabels()",
    );
    expect(extractSourceBetween(source, "this.chestManager.onUpdate(update)", "}),")).toContain(
      "this.reconcileHoverLabels()",
    );
    expect(extractSourceBetween(source, "public updateArmyHexes(", "public updateStructureHexes(")).not.toContain(
      "reconcileHoverLabels",
    );
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

  it("reconciles current hover after initial chunk refresh hydrates managers", () => {
    const source = readWorldmapSource();
    const refreshWarpTravelScene = extractSourceBetween(
      source,
      "private async refreshWarpTravelScene()",
      "private commitCurrentChunkAuthority(",
    );

    const refreshPos = refreshWarpTravelScene.indexOf("await this.updateVisibleChunks(true)");
    const reconcilePos = refreshWarpTravelScene.indexOf('this.reconcileHoverLabels("initial_refresh")');

    expect(refreshPos).toBeGreaterThan(-1);
    expect(reconcilePos).toBeGreaterThan(-1);
    expect(reconcilePos).toBeGreaterThan(refreshPos);
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
      extractSourceBetween(source, "private announceWorldmapSceneReady()", "private prepareWarpTravelInitialSetup()"),
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
      "private async refreshWarpTravelScene()",
    );

    expect(detachWorldmapManagerLabels).toContain("this.hoverLabelManager.onHexLeave()");
    expect(detachWorldmapManagerLabels.indexOf("this.hoverLabelManager.onHexLeave()")).toBeLessThan(
      detachWorldmapManagerLabels.indexOf("this.armyManager.removeLabelsFromScene()"),
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
