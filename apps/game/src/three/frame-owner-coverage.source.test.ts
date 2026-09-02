import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

// A spike names its owner. Per-frame army sync and per-chunk manager work are the two bodies that used to run
// unattributed; the wraps are flat (no nesting) so the dominant-owner digest stays honest.
describe("frame-owner coverage", () => {
  it("attributes the per-frame army update", () => {
    expect(read("./scenes/worldmap.tsx")).toContain(
      'runWithFrameWorkOwner("armies:update", () => this.armyManager.update(deltaTime, animationContext));',
    );
  });

  it("attributes each chunk manager's update", () => {
    expect(read("./scenes/warp-travel-manager-fanout.ts")).toContain(
      "runWithFrameWorkOwner(`chunk:${manager.label}`, () => manager.updateChunk(input.chunkKey, input.options))",
    );
  });

  it("drains frame-budget work and the ingest queue on a frame or a timer, never a frame alone", () => {
    expect(read("./frame-budget-work-queue.ts")).toContain("requestFrameOrTimeout(");
    expect(read("../sync/recs-game-sync-store.ts")).toContain("requestFrameOrTimeout(");
    expect(read("../sync/recs-game-sync-store.ts")).not.toContain("requestAnimationFrame(");
  });
});
