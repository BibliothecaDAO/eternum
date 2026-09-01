// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildTerrainGalleryUrl,
  evaluateTerrainGalleryResults,
} from "./terrain-verification/run-terrain-gallery-verification.mjs";

describe("terrain gallery verification", () => {
  it("builds the auth-free fixed capture URL", () => {
    expect(buildTerrainGalleryUrl("https://localhost:4173/play/anything", "webgpu-force-webgl")).toBe(
      "https://localhost:4173/debug/procedural-terrain?capture=1&rendererMode=webgpu-force-webgl&groundMode=textured&scene=all-biomes&quality=detail",
    );
  });

  it("builds a deterministic reveal-progress capture URL", () => {
    expect(
      buildTerrainGalleryUrl("https://localhost:4173", "webgpu-auto", "textured", "fog-reveal", "detail", 0.5),
    ).toBe(
      "https://localhost:4173/debug/procedural-terrain?capture=1&rendererMode=webgpu-auto&groundMode=textured&scene=fog-reveal&quality=detail&reveal=0.5",
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
    fallback.imageCoverage = 0.04;

    expect(evaluateTerrainGalleryResults(results)).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        "all-biomes/webgpu-force-webgl/textured: browser reported device lost",
        "all-biomes/webgpu-force-webgl/textured: main-thread commit exceeded 8 ms",
        "all-biomes/webgpu-force-webgl/textured: screenshot terrain coverage was below 12%",
        "all-biomes: renderer backends produced different terrain fingerprints",
      ]),
    });
  });

  it("accepts a focused scene/backend/material evaluation slice", () => {
    const focused = [result("webgpu-force-webgl", "webgl2-fallback", "textured")];

    expect(
      evaluateTerrainGalleryResults(focused, {
        groundModes: ["textured"],
        rendererModes: ["webgpu-force-webgl"],
        sceneIds: ["all-biomes"],
      }),
    ).toMatchObject({ ok: true, performanceDeltas: [], reasons: [] });
  });

  it("requires deterministic roads in the owned-road gallery scene", () => {
    const roads = result("webgpu-auto", "webgpu", "textured");
    roads.sceneId = "owned-roads";
    roads.snapshot.sceneId = "owned-roads";
    roads.snapshot.biomeCount = 3;
    roads.snapshot.roadSegments = 15;
    const options = {
      groundModes: ["textured"],
      rendererModes: ["webgpu-auto"],
      sceneIds: ["owned-roads"],
    };

    expect(evaluateTerrainGalleryResults([roads], options)).toMatchObject({ ok: true, reasons: [] });
    roads.snapshot.roadSegments = 0;
    expect(evaluateTerrainGalleryResults([roads], options).reasons).toContain(
      "owned-roads/webgpu-auto/textured: expected deterministic same-owner road segments",
    );
  });

  it("requires disturbance sites in the settlement-regrowth gallery scene", () => {
    const settlement = result("webgpu-auto", "webgpu", "textured");
    settlement.sceneId = "settlement-regrowth";
    settlement.snapshot.sceneId = "settlement-regrowth";
    settlement.snapshot.biomeCount = 3;
    settlement.snapshot.realmInstances = 3;
    settlement.snapshot.settlementSites = 3;
    const options = {
      groundModes: ["textured"],
      rendererModes: ["webgpu-auto"],
      sceneIds: ["settlement-regrowth"],
    };

    expect(evaluateTerrainGalleryResults([settlement], options)).toMatchObject({ ok: true, reasons: [] });
    settlement.snapshot.settlementSites = 0;
    expect(evaluateTerrainGalleryResults([settlement], options).reasons).toContain(
      "settlement-regrowth/webgpu-auto/textured: expected three deterministic settlement disturbance sites",
    );
    settlement.snapshot.settlementSites = 3;
    settlement.snapshot.realmInstances = 0;
    expect(evaluateTerrainGalleryResults([settlement], options).reasons).toContain(
      "settlement-regrowth/webgpu-auto/textured: expected three production Realm instances",
    );
  });

  it("requires fog preview geometry to match the one-ring frontier", () => {
    const fog = result("webgpu-auto", "webgpu", "textured");
    fog.sceneId = "fog-frontier";
    fog.snapshot.sceneId = "fog-frontier";
    fog.snapshot.biomeCount = 10;
    fog.snapshot.fogMaskBytes = 4_096;
    fog.snapshot.fogMaskResolution = 64;
    fog.snapshot.fogTerrainCells = 24;
    fog.snapshot.frontierPreviewCells = 6;
    fog.snapshot.shroudFrontierInstances = 6;
    fog.snapshot.shroudInstances = 24;

    expect(
      evaluateTerrainGalleryResults([fog], {
        groundModes: ["textured"],
        rendererModes: ["webgpu-auto"],
        sceneIds: ["fog-frontier"],
      }),
    ).toMatchObject({ ok: true, reasons: [] });

    fog.snapshot.frontierPreviewCells = 5;
    fog.snapshot.fogTerrainCells = 23;
    fog.snapshot.shroudActiveReveals = 1;
    expect(
      evaluateTerrainGalleryResults([fog], {
        groundModes: ["textured"],
        rendererModes: ["webgpu-auto"],
        sceneIds: ["fog-frontier"],
      }),
    ).toMatchObject({ ok: true, reasons: [] });

    fog.snapshot.frontierPreviewCells = 4;
    expect(
      evaluateTerrainGalleryResults([fog], {
        groundModes: ["textured"],
        rendererModes: ["webgpu-auto"],
        sceneIds: ["fog-frontier"],
      }).reasons,
    ).toContain(
      "fog-frontier/webgpu-auto/textured: frontier preview geometry did not match the committed one-ring fog frontier",
    );
  });

  it("keeps structural gates while treating software-renderer timings as informational", () => {
    const results = healthyResults();
    results.forEach((entry) => {
      entry.snapshot.commitMs = 80;
      entry.snapshot.firstRenderMs = 2_000;
      entry.snapshot.frameP95Ms = 500;
      entry.snapshot.frameSampleCount = 5;
    });

    expect(evaluateTerrainGalleryResults(results, { timingPolicy: "informational" })).toMatchObject({
      ok: true,
      reasons: [],
    });
    results[0].imageCoverage = 0;
    expect(evaluateTerrainGalleryResults(results, { timingPolicy: "informational" }).reasons).toContain(
      "all-biomes/webgpu-auto/flat: screenshot terrain coverage was below 12%",
    );
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
    imageCoverage: 0.42,
    qualityTier: "detail",
    revealProgress: 0,
    ready: true,
    rendererMode,
    routeMounted: true,
    sceneId: "all-biomes",
    snapshot: {
      activeMode,
      biomeCount: 16,
      cellCount: 320,
      commitMs: 4,
      drawCalls: 22,
      fingerprint: "terrain-v1",
      firstRenderMs: 20,
      fogMaskBytes: 0,
      fogMaskResolution: 0,
      fogOpacity: 0.84,
      fogTerrainCells: 0,
      frontierPreviewCells: 0,
      frameP50Ms: 16.6,
      frameP95Ms: 16.7,
      frameWorstMs: 18,
      frameSampleCount: 72,
      groundTextureBytes: 3_406_477,
      groundTextureLayers: 8,
      prepareMs: 20,
      propInstances: 39,
      qualityTier: "detail",
      realmInstances: 0,
      revealProgress: 0,
      roadSegments: 0,
      sceneId: "all-biomes",
      settlementSites: 0,
      shroudActiveReveals: 0,
      shroudFrontierInstances: 0,
      shroudInstances: 0,
      shroudTriangles: 0,
      triangles: 18_300,
      textures: 4,
    },
  };
}
