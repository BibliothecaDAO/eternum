// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap ready signal", () => {
  it("publishes readiness through the route-owned store after setup completes", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("markWorldmapReady");
    expect(source).toContain("onInitialSetupComplete");
    expect(source).toContain("onResumeComplete");
    expect(source).not.toContain("WORLDMAP_SCENE_READY_EVENT");
    expect(source).toContain("onInitialSetupComplete: () => this.announceWorldmapSceneReady()");
  });

  it("does not defer readiness behind speculative pipeline or cosmetic work", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("prewarmPipeline");
    expect(source).not.toContain("preloadAllCosmeticAssets");
  });
});
