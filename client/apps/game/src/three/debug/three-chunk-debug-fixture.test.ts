import { describe, expect, it } from "vitest";

import {
  buildDebugChunkFixture,
  isDebugChunkScenarioId,
  resolveDebugChunkMetrics,
  resolveDebugChunkScenario,
} from "./three-chunk-debug-fixture";

describe("three chunk debug fixture", () => {
  it("builds a deterministic square chunk fixture centered on the origin", () => {
    const fixture = buildDebugChunkFixture({
      chunkRadius: 1,
      chunkSize: 16,
      hotChunkKeys: new Set(["0,0", "1,-1"]),
    });

    expect(fixture.chunks).toHaveLength(9);
    expect(fixture.chunks.map((chunk) => chunk.key)).toEqual([
      "-1,-1",
      "0,-1",
      "1,-1",
      "-1,0",
      "0,0",
      "1,0",
      "-1,1",
      "0,1",
      "1,1",
    ]);
    expect(fixture.chunks.find((chunk) => chunk.key === "1,-1")).toMatchObject({
      heat: "hot",
      center: { x: 16, z: -16 },
      bounds: { minX: 8, maxX: 24, minZ: -24, maxZ: -8 },
    });
  });

  it("summarizes chunk load, tile volume, and draw-call budget for CI assertions", () => {
    const scenario = resolveDebugChunkScenario("stress");
    const metrics = resolveDebugChunkMetrics(scenario);

    expect(scenario).toMatchObject({
      id: "stress",
      label: "Stress Grid",
      chunkRadius: 4,
      chunkSize: 16,
    });
    expect(metrics).toEqual({
      chunkCount: 81,
      tileCount: 20736,
      hotChunkCount: 9,
      estimatedDrawCalls: 3,
    });
  });

  it("guards scenario ids before UI state accepts them", () => {
    expect(isDebugChunkScenarioId("baseline")).toBe(true);
    expect(isDebugChunkScenarioId("unknown")).toBe(false);
  });
});
