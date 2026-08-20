// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap ready signal", () => {
  it("publishes critical readiness through a token-owned entry pass", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("markWorldmapReady");
    expect(source).toContain("completeWorldmapEntryReadiness");
    expect(source).toContain("const bootToken = getCurrentPlayRouteBootToken();");
    expect(source).not.toContain("onInitialSetupComplete: () => this.announceWorldmapSceneReady");
    expect(source).not.toContain("onResumeComplete: () => this.announceWorldmapSceneReady");
    expect(source).not.toContain("WORLDMAP_SCENE_READY_EVENT");
  });

  it("records ambient convergence separately from critical readiness", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("markWorldmapConverged");
    expect(source).toContain('markGameEntryMilestone("worldmap-fetch-completed")');
  });

  it("does not defer readiness behind speculative pipeline or cosmetic work", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("prewarmPipeline");
    expect(source).not.toContain("preloadAllCosmeticAssets");
  });
});
