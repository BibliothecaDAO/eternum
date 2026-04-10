// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameLoadingOverlay source", () => {
  it("waits for the worldmap ready signal instead of the fixed post-map delay", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("waitForWorldmapSceneReady");
    expect(source).not.toContain("POST_WORLD_MAP_LOAD_DELAY_MS = 3_000");
  });

  it("keeps the loading shell open on safety timeout instead of dismissing into a dead map", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("setDidSafetyTimeout(true);");
    expect(source).toContain('if (phase === "timed_out") return ["World map startup is still blocked."];');
  });

  it("records canonical renderer and handoff milestones around overlay dismissal", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("const didReceiveSceneReadySignal = await waitForWorldmapSceneReady");
    expect(source).toContain("if (didReceiveSceneReadySignal) {");
    expect(source).toContain('markGameEntryMilestone("renderer-scene-ready")');
    expect(source).toContain('markGameEntryMilestone("overlay-dismissed")');
    expect(source).toContain('markGameEntryMilestone("world-interactive")');
  });
});
