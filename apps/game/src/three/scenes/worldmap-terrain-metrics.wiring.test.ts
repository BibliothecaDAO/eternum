import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worldmapSource = readFileSync(new URL("./worldmap.tsx", import.meta.url), "utf8");
const rendererFrameSource = readFileSync(new URL("../renderer-frame-runtime.ts", import.meta.url), "utf8");

describe("worldmap terrain metrics production wiring", () => {
  it("routes the production presentation observer into correlated terrain metrics", () => {
    const presentation = worldmapSource.slice(
      worldmapSource.indexOf("private applyTerrainPresentationComposite("),
      worldmapSource.indexOf("private collectVisibleTerrainEcologyAnchors("),
    );

    expect(presentation).toContain("if (this.isSwitchedOff || transitionToken !== this.chunkTransitionToken) return");
    expect(presentation).toContain("(event) => this.recordTerrainPresentationEvent(event)");
    expect(presentation).toContain("recordWorldmapTerrainPresentationEvent(");
    expect(presentation).toContain('this.traceChunk("terrain_page_complete"');
    expect(presentation).toContain('this.traceChunk("terrain_window_converged"');
  });

  it("observes current coverage after a successful backend render and excludes hidden detail terrain", () => {
    const backendRender = rendererFrameSource.indexOf("renderResolvedRendererFrame({");
    const renderedCallback = rendererFrameSource.indexOf("resolvedFrame.sceneController.onFrameRendered?.");
    expect(backendRender).toBeGreaterThan(-1);
    expect(renderedCallback).toBeGreaterThan(backendRender);

    const frameObservation = worldmapSource.slice(
      worldmapSource.indexOf("public onFrameRendered("),
      worldmapSource.indexOf("private syncTerrainMovementInteractions("),
    );
    expect(frameObservation).toContain("this.proceduralTerrain.getPresentationCoverage()");
    expect(frameObservation.indexOf("syncWorldmapTerrainPresentationCoverage(")).toBeLessThan(
      frameObservation.indexOf("recordWorldmapTerrainRenderedFrame("),
    );
    expect(frameObservation).toContain("this.proceduralTerrain.object3d.visible && coverage.pages.length > 0");
    expect(frameObservation).toContain('recordWorldmapRenderDuration("worldmapFrameMs"');
  });

  it("invalidates the scene metrics and frame interval at switch-off", () => {
    const switchOff = worldmapSource.slice(
      worldmapSource.indexOf("onSwitchOff(nextSceneName?: SceneName)"),
      worldmapSource.indexOf("private async renderTileForRealms("),
    );
    expect(switchOff).toContain("disposeScene(this.terrainMetricsSceneId)");
    expect(switchOff).toContain("this.previousSuccessfulFrameAtMs = null");
  });
});
