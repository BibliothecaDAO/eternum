// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildCharacterGymSmokeUrl,
  evaluateCharacterGymSmokeResult,
  normalizeRequestedRendererMode,
} from "./run-character-gym-smoke.mjs";

const PASSING_SNAPSHOT = {
  canvasPresent: true,
  horizontalOverflow: false,
  ready: true,
  routeMounted: true,
  stats: {
    authoredClipCount: 0,
    boneCount: 65,
    bodyCount: 11,
    constraintCount: 10,
    drawCalls: 60,
    geometryCount: 18,
    leftPalmInwardDot: 0.92,
    minimumBendAlignment: 0.84,
    mode: "ragdoll",
    previewArrowVisible: true,
    projectileCapacity: 256,
    projectileDroppedCount: 0,
    projectileHitCount: 1,
    rangedReleaseCount: 1,
    rendererMode: "webgpu",
    rightPalmInwardDot: 0.91,
    stringContinuityError: 0,
    smokeFailures: [],
    smokePhase: "passed",
    skinnedMeshCount: 10,
    triangles: 68_446,
    textureCount: 18,
    wasmHeapMiB: 128,
  },
};
const PASSING_APPEARANCE_SWAPS = [
  {
    appearanceId: "universal-base",
    assetId: "base",
    geometryCount: 12,
    rigAdapterId: "quaternius-universal",
    textureCount: 18,
  },
  {
    appearanceId: "modular-fantasy",
    assetId: "ranger",
    geometryCount: 18,
    rigAdapterId: "quaternius-universal",
    textureCount: 18,
  },
  {
    appearanceId: "universal-base",
    assetId: "base",
    geometryCount: 18,
    rigAdapterId: "quaternius-universal",
    textureCount: 18,
  },
  {
    appearanceId: "modular-fantasy",
    assetId: "ranger",
    geometryCount: 18,
    rigAdapterId: "quaternius-universal",
    textureCount: 18,
  },
];
const PASSING_RAGDOLL_APPEARANCE_SWAPS = PASSING_APPEARANCE_SWAPS.slice(0, 2).map((entry) => ({
  ...entry,
  mode: "animated",
}));

describe("buildCharacterGymSmokeUrl", () => {
  it("builds the auth-free procedural character route", () => {
    expect(buildCharacterGymSmokeUrl({ baseUrl: "https://127.0.0.1:4173" })).toBe(
      "https://127.0.0.1:4173/debug/procedural-characters",
    );
  });

  it("can request the production WebGL2 fallback", () => {
    expect(
      buildCharacterGymSmokeUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "webgpu-force-webgl",
      }),
    ).toBe("https://127.0.0.1:4173/debug/procedural-characters?rendererMode=webgpu-force-webgl");
  });
});

describe("normalizeRequestedRendererMode", () => {
  it("rejects renderer modes the production backend does not support", () => {
    expect(normalizeRequestedRendererMode("webgpu-force-webgl")).toBe("webgpu-force-webgl");
    expect(() => normalizeRequestedRendererMode("legacy-webgl")).toThrow('Unsupported renderer mode "legacy-webgl"');
  });
});

describe("evaluateCharacterGymSmokeResult", () => {
  it("accepts a rendered, settled Jolt ragdoll", () => {
    expect(
      evaluateCharacterGymSmokeResult({
        aimStats: PASSING_SNAPSHOT.stats,
        animatedStats: PASSING_SNAPSHOT.stats,
        appearanceSwaps: PASSING_APPEARANCE_SWAPS,
        browserErrors: [],
        ragdollAppearanceSwaps: PASSING_RAGDOLL_APPEARANCE_SWAPS,
        ragdollBaselineStats: PASSING_SNAPSHOT.stats,
        snapshot: PASSING_SNAPSHOT,
      }),
    ).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("reports promotion gate failures together", () => {
    const snapshot = {
      ...PASSING_SNAPSHOT,
      canvasPresent: false,
      horizontalOverflow: true,
      stats: {
        ...PASSING_SNAPSHOT.stats,
        authoredClipCount: 0,
        boneCount: 0,
        bodyCount: 0,
        constraintCount: 0,
        drawCalls: 0,
        geometryCount: 0,
        mode: "animated",
        projectileCapacity: 0,
        projectileDroppedCount: 1,
        projectileHitCount: 0,
        rangedReleaseCount: 0,
        rendererMode: "initializing",
        smokeFailures: ["non-finite transform"],
        smokePhase: "failed",
        skinnedMeshCount: 0,
        triangles: 0,
        textureCount: 0,
        wasmHeapMiB: 0,
      },
    };

    const animatedStats = {
      ...PASSING_SNAPSHOT.stats,
      leftPalmInwardDot: -0.8,
      rightPalmInwardDot: -0.75,
    };
    const aimStats = {
      ...PASSING_SNAPSHOT.stats,
      leftPalmInwardDot: -0.4,
      previewArrowVisible: false,
      rightPalmInwardDot: -0.3,
      stringContinuityError: 0.2,
    };

    expect(
      evaluateCharacterGymSmokeResult({
        aimStats,
        animatedStats,
        appearanceSwaps: PASSING_APPEARANCE_SWAPS,
        browserErrors: ["runtime exploded"],
        ragdollAppearanceSwaps: PASSING_RAGDOLL_APPEARANCE_SWAPS,
        ragdollBaselineStats: PASSING_SNAPSHOT.stats,
        snapshot,
      }).reasons,
    ).toEqual([
      "character gym canvas was missing",
      "character gym had horizontal overflow",
      "left palm faced outward (-0.8)",
      "right palm faced outward (-0.75)",
      "full-draw left palm faced outward (-0.4)",
      "full-draw right palm faced outward (-0.3)",
      "full-draw preview arrow was not attached",
      "full-draw string continuity error was 0.2",
      "smoke phase was failed, expected passed",
      "smoke reported: non-finite transform",
      "bone count was 0, expected 65",
      "skinned mesh count was 0, expected the optimized Ranger archer",
      "body count was 0, expected 11",
      "constraint count was 0, expected 10",
      "archer emitted no release edge",
      "pooled arrow did not hit the target",
      "projectile capacity was 0, expected 256",
      "projectile pool dropped an arrow",
      "runtime mode was animated, expected ragdoll",
      "renderer mode was initializing, expected webgpu or webgl2-fallback",
      "renderer reported no draw calls",
      "renderer reported no triangles",
      "renderer reported no live geometries",
      "renderer reported no live textures",
      "Jolt WASM reported no allocated heap",
      "browser reported 1 runtime error(s): runtime exploded",
    ]);
  });

  it("includes failed collision scenarios in the promotion gate", () => {
    const result = evaluateCharacterGymSmokeResult({
      aimStats: PASSING_SNAPSHOT.stats,
      animatedStats: PASSING_SNAPSHOT.stats,
      appearanceSwaps: PASSING_APPEARANCE_SWAPS,
      browserErrors: [],
      ragdollAppearanceSwaps: PASSING_RAGDOLL_APPEARANCE_SWAPS,
      ragdollBaselineStats: PASSING_SNAPSHOT.stats,
      collisionScenarios: [{ reasons: ["no contact"], scenario: "head-on", status: "fail" }],
      snapshot: PASSING_SNAPSHOT,
    });

    expect(result.reasons).toContain("head-on collision scenario was fail: no contact");
  });

  it("rejects a smoke run that did not restore the selected appearance", () => {
    const result = evaluateCharacterGymSmokeResult({
      aimStats: PASSING_SNAPSHOT.stats,
      animatedStats: PASSING_SNAPSHOT.stats,
      appearanceSwaps: [PASSING_APPEARANCE_SWAPS[0]],
      browserErrors: [],
      ragdollAppearanceSwaps: PASSING_RAGDOLL_APPEARANCE_SWAPS,
      ragdollBaselineStats: PASSING_SNAPSHOT.stats,
      snapshot: PASSING_SNAPSHOT,
    });

    expect(result.reasons).toContain("appearance swap sequence did not restore Modular Fantasy");
  });
});
