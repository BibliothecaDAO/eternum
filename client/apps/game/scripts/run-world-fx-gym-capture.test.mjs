import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_FX_CAPTURE_CASES, buildWorldFxCaptureUrl, evaluateWorldFxCapture } from "./run-world-fx-gym-capture.mjs";

test("captures every procedural gameplay recipe", () => {
  assert.deepEqual([...new Set(WORLD_FX_CAPTURE_CASES.map(({ scene }) => scene))].toSorted(), [
    "aura",
    "beam",
    "dragon-breath",
    "explosion",
    "flame",
    "impact",
    "mixed",
    "projectile-trail",
    "realm-flame",
    "resource-flow",
    "resource-flow-stress",
    "shockwave",
  ]);
});

test("builds deterministic capture URLs", () => {
  const url = new URL(
    buildWorldFxCaptureUrl({
      baseUrl: "https://127.0.0.1:4173",
      captureCase: WORLD_FX_CAPTURE_CASES[0],
      rendererMode: "webgpu-force-webgl",
      seed: 42,
    }),
  );
  assert.equal(url.pathname, "/debug/world-fx");
  assert.equal(url.searchParams.get("capture"), "1");
  assert.equal(url.searchParams.get("seed"), "42");
  assert.equal(url.searchParams.get("view"), "detail");
});

test("accepts the current mixed-library stress budget", () => {
  const captureCase = WORLD_FX_CAPTURE_CASES.find(({ name }) => name === "mixed-stress");
  const result = evaluateWorldFxCapture(
    captureCase,
    {
      activeAdditiveParticles: 1_349,
      activeMode: "webgl2-fallback",
      activeRings: 34,
      activeSmokeParticles: 296,
      additiveCapacity: 2_048,
      drawCalls: 3,
      droppedCount: 0,
      geometryCount: 6,
      rendererDrawCalls: 9,
      rendererTriangles: 9_119,
      ringCapacity: 256,
      smokeCapacity: 1_024,
      textureCount: 3,
      triangles: 3_358,
      view: "detail",
    },
    "webgl2-fallback",
  );
  assert.equal(result.ok, true);
});

test("rejects pool, draw, and geometry regressions", () => {
  const result = evaluateWorldFxCapture(
    WORLD_FX_CAPTURE_CASES[0],
    {
      activeAdditiveParticles: 30,
      activeMode: "webgpu",
      activeRings: 0,
      activeSmokeParticles: 4,
      additiveCapacity: 4_096,
      drawCalls: 4,
      droppedCount: 2,
      geometryCount: 7,
      rendererDrawCalls: 10,
      rendererTriangles: 200,
      ringCapacity: 256,
      smokeCapacity: 1_024,
      textureCount: 4,
      triangles: 70,
      view: "detail",
    },
    "webgl2-fallback",
  );
  assert.equal(result.ok, false);
  assert.ok(result.reasons.length >= 6);
});
