// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildProceduralWorldGymSmokeUrl,
  evaluateProceduralWorldGymSmokeResult,
} from "./run-procedural-world-gym-smoke.mjs";

const passingSnapshot = {
  canvasPresent: true,
  config: { actorCount: 100, locomotionMode: "walk", unitMix: "balanced" },
  horizontalOverflow: false,
  ready: true,
  routeMounted: true,
  stats: {
    actorCount: 100,
    drawCalls: 500,
    environmentMode: "procedural-biomes",
    ragdollCount: 0,
    rendererMode: "webgpu",
    runningCount: 100,
    simulationElapsedSeconds: 2,
    terrainBiomeCount: 16,
    terrainCellCount: 196,
    terrainGroundedActorCount: 100,
    terrainMaximumRootError: 0,
    terrainPropCount: 80,
    terrainSurfaceMissCount: 0,
    triangles: 1_900_000,
  },
  terrainReady: true,
};

describe("procedural world gym smoke contract", () => {
  it("builds the auth-free route without carrying unrelated query state", () => {
    expect(
      buildProceduralWorldGymSmokeUrl({
        baseUrl: "https://127.0.0.1:4174/play/map?foo=bar",
        rendererMode: "webgpu-force-webgl",
      }),
    ).toBe("https://127.0.0.1:4174/debug/procedural-world-gym?rendererMode=webgpu-force-webgl");
  });

  it("accepts a moving, fully grounded 100-character biome scene", () => {
    expect(evaluateProceduralWorldGymSmokeResult(passingSnapshot, [])).toEqual({ ok: true, reasons: [] });
  });

  it("rejects missing terrain coverage and incorrect locomotion", () => {
    const evaluation = evaluateProceduralWorldGymSmokeResult(
      {
        ...passingSnapshot,
        config: { ...passingSnapshot.config, locomotionMode: "run" },
        stats: {
          ...passingSnapshot.stats,
          terrainGroundedActorCount: 97,
          terrainMaximumRootError: 0.12,
          terrainSurfaceMissCount: 3,
        },
      },
      [],
    );

    expect(evaluation.ok).toBe(false);
    expect(evaluation.reasons).toContain("world gym did not start in walk mode");
    expect(evaluation.reasons).toContain("one or more actors left the terrain surface");
    expect(evaluation.reasons).toContain("world gym grounded 97/100 actors");
  });
});
