// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("local-view texture prewarm wiring", () => {
  it("starts only after worldmap convergence and attributes each upload", () => {
    const source = readSource("src/three/game-renderer.ts");

    expect(source).toContain("usePlayRouteReadinessStore.getState().worldmapConverged");
    expect(source).toContain("state.worldmapConverged");
    expect(source).toContain('runWithFrameWorkOwner("scene:hexception:texture-prewarm"');
    expect(source).toContain("this.renderer.initTexture!(texture)");
  });

  it("re-arms after a hidden page returns without re-arming after renderer loss", () => {
    const source = readSource("src/three/game-renderer.ts");
    const recoveryResume = source.slice(
      source.indexOf("private resumeRendererAfterDeviceLossFallback"),
      source.indexOf("private handleDeviceLossFallbackFailure"),
    );

    expect(source).toContain('document.addEventListener("visibilitychange"');
    expect(source).toContain('this.cancelLocalViewTexturePrewarm("page_hidden")');
    expect(source).toContain("this.shouldArmLocalViewTexturePrewarmWhenVisible = true");
    expect(source).toContain("this.hasRendererDeviceLossOccurred = true");
    expect(source.match(/this\.cancelLocalViewTexturePrewarm\("renderer_destroyed"\)/g)).toHaveLength(2);
    expect(recoveryResume).not.toContain("this.armLocalViewTexturePrewarm()");
  });

  it("waits for local models and discovers their unique textures without attaching them to the map", () => {
    const source = readSource("src/three/scenes/hexception.tsx");

    expect(source).toContain("await Promise.allSettled([...this.modelLoadPromises])");
    expect(source).toContain("collectObjectTextures(this.scene)");
    expect(source).toContain("collectObjectTextures(model, textures)");
    expect(source).not.toContain("this.worldmapScene.resolveLocalViewTextures");
  });
});
