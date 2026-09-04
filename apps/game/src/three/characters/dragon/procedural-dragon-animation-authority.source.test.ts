// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("procedural dragon animation authority", () => {
  it("does not route idle, walk, or flight through authored animation clips", () => {
    const sources = [
      readFileSync(new URL("./icy-dragon-assets.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./procedural-dragon-avatar.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./procedural-dragon-runtime.ts", import.meta.url), "utf8"),
    ];
    const runtimeSource = sources.join("\n");

    expect(runtimeSource).not.toContain("AnimationMixer");
    expect(runtimeSource).not.toContain("AnimationAction");
    expect(runtimeSource).not.toContain("clipAction");
    expect(runtimeSource).not.toContain("ICY_CLIP_INDEX");
    expect(runtimeSource).not.toContain("mixer.update");
    expect(runtimeSource).toContain("discardIcyAuthoredAnimations");
    expect(runtimeSource).toContain("applyIcyProceduralRigPose");
  });
});
