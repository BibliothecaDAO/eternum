// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildTerrainGalleryUrl,
  evaluateTerrainGalleryResults,
} from "./terrain-verification/run-terrain-gallery-verification.mjs";

describe("terrain gallery verification", () => {
  it("builds the auth-free fixed capture URL", () => {
    expect(buildTerrainGalleryUrl("https://localhost:4173/play/anything", "webgpu-force-webgl")).toBe(
      "https://localhost:4173/debug/procedural-terrain?capture=1&rendererMode=webgpu-force-webgl&groundMode=textured",
    );
  });

  it("passes matching healthy backend evidence", () => {
    const results = healthyResults();
    expect(evaluateTerrainGalleryResults(results)).toMatchObject({ ok: true, reasons: [] });
    expect(evaluateTerrainGalleryResults(results).performanceDeltas).toHaveLength(2);
  });

  it("reports backend parity, performance, and browser failures", () => {
    const results = healthyResults();
    const fallback = results.find(
      ({ rendererMode, groundMode }) => rendererMode === "webgpu-force-webgl" && groundMode === "textured",
    );
    fallback.snapshot.fingerprint = "different";
    fallback.snapshot.commitMs = 9;
    fallback.errors = ["device lost"];

    expect(evaluateTerrainGalleryResults(results)).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        "webgpu-force-webgl/textured: browser reported device lost",
        "webgpu-force-webgl/textured: main-thread commit exceeded 8 ms",
        "renderer backends produced different terrain fingerprints",
      ]),
    });
  });
});

function healthyResults() {
  return [
    result("webgpu-auto", "webgpu", "flat"),
    result("webgpu-auto", "webgpu", "textured"),
    result("webgpu-force-webgl", "webgl2-fallback", "flat"),
    result("webgpu-force-webgl", "webgl2-fallback", "textured"),
  ];
}

function result(rendererMode, activeMode, groundMode) {
  return {
    errors: [],
    groundMode,
    ready: true,
    rendererMode,
    routeMounted: true,
    snapshot: {
      activeMode,
      biomeCount: 16,
      cellCount: 320,
      commitMs: 4,
      drawCalls: 22,
      fingerprint: "terrain-v1",
      firstRenderMs: 20,
      frameP50Ms: 16.6,
      frameP95Ms: 16.7,
      frameWorstMs: 18,
      frameSampleCount: 72,
      groundTextureBytes: 3_406_477,
      groundTextureLayers: 8,
      prepareMs: 20,
      propInstances: 39,
      triangles: 18_300,
      textures: 4,
    },
  };
}
