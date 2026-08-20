import { describe, expect, it } from "vitest";
import { formatWorldmapChunkWarning } from "./worldmap-chunk-trace";

describe("formatWorldmapChunkWarning", () => {
  it("keeps the useful fields from a captured chunk warning on one line", () => {
    const warning = formatWorldmapChunkWarning("terrain_shell_stale_dropped", {
      chunkKey: "24,48",
      reason: "exact terrain\nalready committed",
      transitionToken: 9,
      ignoredObject: { large: true },
    });

    expect(warning).toBe(
      '[WorldmapChunk] terrain_shell_stale_dropped chunkKey="24,48" reason="exact terrain already committed" transitionToken=9',
    );
    expect(warning).not.toMatch(/[\r\n]/);
  });

  it("retains the primitive authority fields from a stale presentation drop", () => {
    expect(
      formatWorldmapChunkWarning("terrain_shell_stale_dropped", {
        chunkKey: "24,48",
        kind: "provisional",
        transitionToken: 8,
        currentTransitionToken: 9,
      }),
    ).toBe(
      '[WorldmapChunk] terrain_shell_stale_dropped chunkKey="24,48" kind="provisional" transitionToken=8 currentTransitionToken=9',
    );
  });
});
