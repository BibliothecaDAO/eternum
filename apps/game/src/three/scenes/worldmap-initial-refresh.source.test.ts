// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap interactive refresh", () => {
  it("joins active transitions and delegates phase-aware retry and failure handling", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("commitCriticalPass: () => this.commitCriticalWorldmapPass(phase)");
    expect(source).toContain("await completeWorldmapInteractiveRefresh({");
    expect(source).toContain('const phase: WorldmapWarpTravelPhase = this.hasInitialized ? "resume" : "initial";');
    expect(source).toMatch(
      /private async refreshVisibleChunksForWarpTravel\(phase: WorldmapWarpTravelPhase\): Promise<boolean> \{[\s\S]*waitForChunkTransitionToSettle/,
    );
    expect(source).toContain('this.updateVisibleChunks(true, { reason: "default", triggerReason: `${phase}_setup` })');
  });

  it("propagates the terrain commit result instead of treating every settled transition as success", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("onResolved: (committed) => {");
    expect(source).toContain('return refreshCommitStatus === "committed";');
  });
});
