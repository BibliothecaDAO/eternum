import { describe, expect, it } from "vitest";

import {
  evaluateWorldmapTerrainObservation,
  summarizeWorldmapTerrainVerification,
} from "./terrain-verification/evaluate-worldmap-terrain.mjs";

const expected = {
  cameraTarget: { col: 0, row: 0 },
  gameId: 21,
  pathname: "/play/madara/review/map",
  rendererMode: "webgpu-auto",
  worldName: "review",
};

describe("production worldmap terrain verification", () => {
  it("accepts identified authoritative coverage at the requested target with a correlated frame", () => {
    expect(evaluateWorldmapTerrainObservation(observation(), expected)).toMatchObject({ status: "pass", reasons: [] });
  });

  it.each(["geometry", "props", "fog"])("never accepts missing %s writes", (kind) => {
    const input = observation();
    input.renderDiagnostics.terrainPresentation.current.coverage[kind] = false;

    expect(evaluateWorldmapTerrainObservation(input, expected).status).toBe("inconclusive");
  });

  it("rejects an old frame and incomplete or non-finite presentation milestones", () => {
    const oldFrame = observation();
    oldFrame.renderDiagnostics.terrainPresentation.current.windowFullyRenderedRevision = 2;
    expect(evaluateWorldmapTerrainObservation(oldFrame, expected).status).not.toBe("pass");

    const incomplete = observation();
    incomplete.renderDiagnostics.terrainPresentation.current.sourceReadyAtMs = Number.NaN;
    incomplete.renderDiagnostics.terrainPresentation.current.completePageKeys = [];
    expect(evaluateWorldmapTerrainObservation(incomplete, expected).status).not.toBe("pass");
  });

  it("does not mistake partial or wrong-window coverage for the requested camera window", () => {
    const partial = observation();
    partial.trace[0].details.activePageKeys.push("-12,12");
    expect(evaluateWorldmapTerrainObservation(partial, expected).status).toBe("inconclusive");

    const duplicate = observation();
    duplicate.renderDiagnostics.terrainPresentation.current.completePageKeys.push("-12,-12");
    expect(evaluateWorldmapTerrainObservation(duplicate, expected).status).toBe("fail");
  });

  it("uses the direct active visual window when the bounded trace no longer contains its resolution event", () => {
    const input = observation();
    input.trace = [{ event: "terrain_composite_rebuilt" }];
    input.visualWindow = { centerPageKey: "-12,-12", pageKeys: ["-12,-12"] };

    expect(evaluateWorldmapTerrainObservation(input, expected).status).toBe("pass");
  });

  it("does not accept a newer unrelated revision when the camera missed its requested target", () => {
    const input = observation();
    input.cameraTargetHex = { col: 24, row: 0 };
    input.renderDiagnostics.terrainPresentation.current.revision = 4;
    input.renderDiagnostics.terrainPresentation.current.windowFullyRenderedRevision = 4;

    const result = evaluateWorldmapTerrainObservation(input, { ...expected, previousRevision: 3 });

    expect(result).toMatchObject({
      status: "inconclusive",
      reasons: expect.arrayContaining([expect.stringContaining("has not reached requested")]),
    });
  });

  it("requires active game identity and populated authoritative RECS rows", () => {
    const input = observation();
    input.gameIdentity = {
      pathname: expected.pathname,
      gameId: null,
      namespace: null,
      structureRows: 0,
      tileRows: 0,
      worldAddress: null,
    };

    const result = evaluateWorldmapTerrainObservation(input, expected);

    expect(result).toMatchObject({ status: "inconclusive" });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "active game id is unavailable",
        "active world address is unavailable",
        "authoritative TileOpt rows are unavailable",
        "authoritative Structure rows are unavailable",
      ]),
    );
  });

  it("cannot count WebGL fallback as native WebGPU evidence", () => {
    const input = observation();
    input.renderer.activeMode = "webgl2-fallback";

    expect(evaluateWorldmapTerrainObservation(input, expected).status).toBe("inconclusive");
  });

  it("fails browser and known console runtime errors", () => {
    const input = observation();
    input.errors = ["Worker crashed"];
    input.consoleErrors = ["WebGPU shader compilation failed"];

    expect(evaluateWorldmapTerrainObservation(input, expected)).toMatchObject({ status: "fail" });
  });

  it("bounds prepared cache and page slots and rejects warm-loop renderer growth", () => {
    const policy = { baseline: { geometries: 10, textures: 5 }, tolerance: { geometries: 2, textures: 1 } };
    const input = observation();
    input.resourceState = { geometries: 13, preparedCachePages: 65, presentedPageSlots: 17, textures: 7 };

    const result = evaluateWorldmapTerrainObservation(input, { ...expected, resourcePolicy: policy });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "prepared terrain cache exceeds 64 pages",
        "presented terrain pool exceeds 16 page slots",
        "renderer geometry resources grew beyond the warm-loop tolerance",
        "renderer texture resources grew beyond the warm-loop tolerance",
      ]),
    );
  });

  it("keeps missing resource samples inconclusive instead of treating them as zero", () => {
    const input = observation();
    input.resourceState.preparedCachePages = null;

    expect(
      evaluateWorldmapTerrainObservation(input, { ...expected, resourcePolicy: { baseline: null } }),
    ).toMatchObject({
      status: "inconclusive",
      reasons: expect.arrayContaining(["terrain cache, page-pool, or renderer resource measurements are unavailable"]),
    });
  });

  it("separates navigation success from full acceptance and keeps unperformed requirements nonzero", () => {
    const summary = summarizeWorldmapTerrainVerification([passingResult()], {
      notExercised: ["stationary authoritative structure update"],
    });

    expect(summary).toMatchObject({
      status: "inconclusive",
      exitCode: 2,
      navigation: { status: "pass" },
      fullAcceptance: {
        status: "inconclusive",
        reasons: ["required scenario not exercised: stationary authoritative structure update"],
      },
    });
    expect(summarizeWorldmapTerrainVerification([]).exitCode).toBe(2);
    expect(
      summarizeWorldmapTerrainVerification([{ name: "entry", status: "fail", reasons: ["broken"] }]),
    ).toMatchObject({ status: "fail", exitCode: 1 });
  });
});

function observation() {
  return {
    cameraTargetHex: { col: 0, row: 0 },
    canvasPresent: true,
    consoleErrors: [],
    errors: [],
    gameIdentity: {
      gameId: 21,
      namespace: "s2",
      pathname: expected.pathname,
      structureRows: 2,
      tileRows: 10,
      worldAddress: "0x123",
      worldName: "review",
    },
    renderer: { activeMode: "webgpu" },
    resourceState: { geometries: 10, preparedCachePages: 12, presentedPageSlots: 1, textures: 5 },
    trace: [
      { event: "visual_window_resolved", details: { activePageKeys: ["-12,-12"] } },
      { event: "terrain_composite_rebuilt" },
    ],
    renderDiagnostics: {
      gauges: { worldBiomeSurfaceInstances: 10 },
      terrainPresentation: {
        contractVersion: 2,
        current: {
          completePageKeys: ["-12,-12"],
          converged: true,
          coverage: { geometry: true, props: "uploaded", fog: true },
          firstCompletePageAtMs: 3,
          requestedAtMs: 1,
          requestedPageKeys: ["-12,-12"],
          revision: 3,
          sceneId: "worldmap-1",
          sourceReadyAtMs: 2,
          windowCompleteAtMs: 4,
          windowFullyRenderedAtMs: 5,
          windowFullyRenderedBackend: "webgpu",
          windowFullyRenderedRevision: 3,
        },
      },
    },
  };
}

function passingResult() {
  return { name: "entry", status: "pass", reasons: [] };
}
