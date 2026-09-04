// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap ready signal", () => {
  it("publishes critical readiness through a token-owned entry pass", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("markWorldmapReady");
    expect(source).toContain("startWorldmapEntryReadiness");
    expect(source).toContain("const readiness = usePlayRouteReadinessStore.getState();");
    expect(source).toContain("const bootToken = readiness.bootToken;");
    expect(source).toContain("const requiresAmbientConvergence = !readiness.worldmapConverged;");
    expect(source).toContain("setupContext.isCurrent() && bootToken === getCurrentPlayRouteBootToken()");
    expect(source).not.toContain("onInitialSetupComplete: () => this.announceWorldmapSceneReady");
    expect(source).not.toContain("onResumeComplete: () => this.announceWorldmapSceneReady");
    expect(source).not.toContain("WORLDMAP_SCENE_READY_EVENT");
  });

  it("records ambient convergence separately from critical readiness", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("markWorldmapConverged");
    expect(source).toContain('markGameEntryMilestone("worldmap-fetch-completed")');
    expect(source).toContain("await this.waitForLatestTerrainPresentation()");
    expect(source).toContain('markGameEntryMilestone("worldmap-terrain-visible")');
    expect(source).toContain("reportAmbientConvergenceError");
  });

  it("does not defer readiness behind speculative pipeline or cosmetic work", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("prewarmPipeline");
    expect(source).not.toContain("preloadAllCosmeticAssets");
  });
});
