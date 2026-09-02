import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "./hexception.tsx"), "utf8");

// Store subscriptions (overlay dismissal, structure level updates) fire in every scene. A grid rebuild that runs
// while the world map is the active scene ends in a hex-ready mark that dismisses the map boot and strands a
// map-first handoff on the map. The scene's entered fact is the one gate.
describe("hexception scene entry gate", () => {
  it("owns an entered fact spanning setup to switch-off", () => {
    expect(source).toContain("  setup() {\n    this.isEntered = true;");
    expect(source).toContain("  onSwitchOff(_nextSceneName?: SceneName) {\n    this.isEntered = false;");
  });

  it("rebuilds the grid and marks hex readiness only while entered", () => {
    expect(source).toContain("  updateHexceptionGrid(radius: number) {\n    if (!this.isEntered) return;");
    expect(source).toContain(
      'if (typeof window !== "undefined" && this.isEntered) {\n            usePlayRouteReadinessStore.getState().markHexReady(',
    );
  });
});
