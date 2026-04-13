// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameLoadingOverlay source", () => {
  it("reads the shared play-route boot snapshot and readiness store instead of session handoff state", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("usePlayRouteBootSnapshot");
    expect(source).toContain("usePlayRouteReadinessStore");
    expect(source).not.toContain("consumePlayRouteHandoff");
  });

  it("keeps the loading shell open on safety timeout instead of dismissing into a dead map", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("setDidSafetyTimeout(true);");
    expect(source).toContain('"World map startup is still blocked."');
  });

  it("records canonical renderer and dismissal milestones around the shared boot readiness flow", () => {
    const source = readSource("src/ui/layouts/game-loading-overlay.tsx");

    expect(source).toContain("readiness.worldmapReady");
    expect(source).toContain("buildPlayHref");
    expect(source).toContain('markGameEntryMilestone("renderer-scene-ready")');
    expect(source).toContain('markGameEntryMilestone("overlay-dismissed")');
    expect(source).toContain('markGameEntryMilestone("world-interactive")');
  });
});
