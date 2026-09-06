import { describe, expect, it } from "vitest";

import {
  createWorldmapTerrainPresentationMetrics,
  recordWorldmapTerrainPageCompletion,
  recordWorldmapTerrainPresentationRequest,
  recordWorldmapTerrainRenderedFrame,
  recordWorldmapTerrainSourceReady,
  recordWorldmapTerrainPropsUploaded,
  recordWorldmapTerrainWindowCompletion,
  snapshotWorldmapTerrainPresentationMetrics,
} from "./worldmap-terrain-presentation-metrics";

const PAGE_WORK = {
  attribution: "built" as const,
  commitCpuMs: 2,
  queueWaitMs: 4,
  workerBuildMs: 12,
};

describe("worldmap terrain presentation metrics", () => {
  it("keeps source, focus-page, window, and rendered-frame milestones distinct", () => {
    const metrics = createWorldmapTerrainPresentationMetrics();

    recordWorldmapTerrainPresentationRequest(metrics, {
      requestedAtMs: 100,
      revision: 7,
      sceneId: "world:54:scene:1",
    });
    recordWorldmapTerrainSourceReady(metrics, {
      atMs: 105,
      requestedPages: [
        { fingerprint: null, pageKey: "focus" },
        { fingerprint: null, pageKey: "east" },
      ],
      revision: 7,
      sceneId: "world:54:scene:1",
    });

    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current).toMatchObject({
      completePageKeys: [],
      converged: false,
      firstCompletePageAtMs: null,
      firstCompletePageRenderedAtMs: null,
      requestedPageKeys: ["focus", "east"],
      sourceReadyAtMs: 105,
      windowCompleteAtMs: null,
    });
    recordWorldmapTerrainPageCompletion(metrics, {
      completedAtMs: 130,
      coverage: { fog: true, geometry: true, props: "uploaded" },
      fingerprint: "focus-v1",
      pageKey: "focus",
      revision: 7,
      sceneId: "world:54:scene:1",
      work: PAGE_WORK,
    });

    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current).toMatchObject({
      completePageKeys: ["focus"],
      converged: false,
      firstCompletePageAtMs: 130,
      firstCompletePageRenderedAtMs: null,
      windowCompleteAtMs: null,
    });
    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 135,
        backend: "webgpu",
        detailedTerrainVisible: true,
        sceneId: "world:54:scene:1",
      }),
    ).toMatchObject({ firstCompletePageRendered: true, firstCompletePageRenderedDurationMs: 35 });

    recordWorldmapTerrainPageCompletion(metrics, {
      completedAtMs: 145,
      coverage: { fog: true, geometry: true, props: "stored" },
      fingerprint: "east-v1",
      pageKey: "east",
      revision: 7,
      sceneId: "world:54:scene:1",
      work: { attribution: "cache", commitCpuMs: 1, queueWaitMs: 0, workerBuildMs: 0 },
    });
    recordWorldmapTerrainWindowCompletion(metrics, {
      completedAtMs: 150,
      revision: 7,
      sceneId: "world:54:scene:1",
    });

    recordWorldmapTerrainPropsUploaded(metrics, {
      atMs: 155,
      pages: [{ fingerprint: "east-v1", pageKey: "east" }],
      revision: 7,
      sceneId: "world:54:scene:1",
    });

    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current).toMatchObject({
      completePageKeys: ["focus", "east"],
      converged: true,
      coverage: { fog: true, geometry: true, props: "uploaded" },
      windowFullyRenderedAtMs: null,
      pageFingerprints: { east: "east-v1", focus: "focus-v1" },
      windowCompleteAtMs: 150,
      work: {
        builtPages: 1,
        cachePages: 1,
        commitCpuMs: 3,
        queueWaitMs: 4,
        sharedInFlightPages: 0,
        workerBuildMs: 12,
      },
    });

    const rendered = recordWorldmapTerrainRenderedFrame(metrics, {
      atMs: 160,
      backend: "webgpu",
      detailedTerrainVisible: true,
      sceneId: "world:54:scene:1",
    });

    expect(rendered).toMatchObject({
      firstCompletePageRendered: false,
      firstCompletePageRenderedDurationMs: null,
      revision: 7,
      windowFullyRendered: true,
      windowFullyRenderedDurationMs: 60,
    });
    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current).toMatchObject({
      firstCompletePageRenderedAtMs: 135,
      firstCompletePageRenderedBackend: "webgpu",
      firstCompletePageRenderedRevision: 7,
      windowFullyRenderedAtMs: 160,
      windowFullyRenderedBackend: "webgpu",
      windowFullyRenderedRevision: 7,
    });
  });

  it("does not let failed, unrelated, pre-convergence, or repeated frames certify a target", () => {
    const metrics = createWorldmapTerrainPresentationMetrics();
    recordWorldmapTerrainPresentationRequest(metrics, {
      requestedAtMs: 10,
      revision: 2,
      sceneId: "scene:a",
    });
    recordWorldmapTerrainSourceReady(metrics, {
      atMs: 12,
      requestedPages: [{ fingerprint: null, pageKey: "focus" }],
      revision: 2,
      sceneId: "scene:a",
    });
    recordWorldmapTerrainPageCompletion(metrics, {
      completedAtMs: 20,
      coverage: { fog: true, geometry: true, props: "stored" },
      fingerprint: "focus-v2",
      pageKey: "focus",
      revision: 2,
      sceneId: "scene:a",
      work: PAGE_WORK,
    });

    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 21,
        backend: "webgpu",
        detailedTerrainVisible: false,
        sceneId: "scene:a",
      }),
    ).toMatchObject({ firstCompletePageRendered: false });
    recordWorldmapTerrainWindowCompletion(metrics, { completedAtMs: 22, revision: 2, sceneId: "scene:a" });
    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 23,
        backend: "webgpu",
        detailedTerrainVisible: true,
        rendered: false,
        sceneId: "scene:a",
      }),
    ).toMatchObject({ firstCompletePageRendered: false });
    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 24,
        backend: "webgpu",
        detailedTerrainVisible: true,
        sceneId: "scene:b",
      }),
    ).toMatchObject({ firstCompletePageRendered: false });
    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 25,
        backend: "webgl2-fallback",
        detailedTerrainVisible: true,
        sceneId: "scene:a",
      }),
    ).toMatchObject({ firstCompletePageRendered: true, windowFullyRendered: false });
    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 30,
        backend: "webgpu",
        detailedTerrainVisible: true,
        sceneId: "scene:a",
      }),
    ).toMatchObject({ firstCompletePageRendered: false, windowFullyRendered: false });

    recordWorldmapTerrainPropsUploaded(metrics, {
      atMs: 31,
      pages: [{ fingerprint: "focus-v2", pageKey: "focus" }],
      revision: 2,
      sceneId: "scene:a",
    });
    expect(
      recordWorldmapTerrainRenderedFrame(metrics, {
        atMs: 32,
        backend: "webgpu",
        detailedTerrainVisible: true,
        sceneId: "scene:a",
      }),
    ).toMatchObject({ firstCompletePageRendered: false, windowFullyRendered: true });
  });

  it("rejects stale page and window callbacks after supersession or scene disposal", () => {
    const metrics = createWorldmapTerrainPresentationMetrics();
    recordWorldmapTerrainPresentationRequest(metrics, {
      requestedAtMs: 10,
      revision: 1,
      sceneId: "scene:a",
    });
    recordWorldmapTerrainSourceReady(metrics, {
      atMs: 10,
      requestedPages: [{ fingerprint: null, pageKey: "old" }],
      revision: 1,
      sceneId: "scene:a",
    });
    recordWorldmapTerrainPresentationRequest(metrics, {
      requestedAtMs: 20,
      revision: 2,
      sceneId: "scene:a",
    });
    recordWorldmapTerrainSourceReady(metrics, {
      atMs: 20,
      requestedPages: [{ fingerprint: "new-v1", pageKey: "new" }],
      revision: 2,
      sceneId: "scene:a",
    });

    expect(
      recordWorldmapTerrainPageCompletion(metrics, {
        completedAtMs: 30,
        coverage: { fog: true, geometry: true, props: "uploaded" },
        fingerprint: "old-v1",
        pageKey: "old",
        revision: 1,
        sceneId: "scene:a",
        work: PAGE_WORK,
      }),
    ).toMatchObject({ accepted: false });
    expect(
      recordWorldmapTerrainPageCompletion(metrics, {
        completedAtMs: 31,
        coverage: { fog: true, geometry: true, props: "uploaded" },
        fingerprint: "wrong",
        pageKey: "new",
        revision: 2,
        sceneId: "scene:a",
        work: PAGE_WORK,
      }),
    ).toMatchObject({ accepted: false });
    expect(
      recordWorldmapTerrainWindowCompletion(metrics, { completedAtMs: 32, revision: 1, sceneId: "scene:a" }),
    ).toMatchObject({ accepted: false });

    metrics.disposeScene("scene:a");
    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current).toBeNull();
    expect(
      recordWorldmapTerrainWindowCompletion(metrics, { completedAtMs: 40, revision: 2, sceneId: "scene:a" }),
    ).toMatchObject({ accepted: false });
  });

  it("attributes only new worker builds and keeps shared wait separate", () => {
    const metrics = createWorldmapTerrainPresentationMetrics();
    recordWorldmapTerrainPresentationRequest(metrics, {
      requestedAtMs: 0,
      revision: 1,
      sceneId: "scene",
    });
    recordWorldmapTerrainSourceReady(metrics, {
      atMs: 0,
      requestedPages: [
        { fingerprint: null, pageKey: "built" },
        { fingerprint: null, pageKey: "cached" },
        { fingerprint: null, pageKey: "shared" },
      ],
      revision: 1,
      sceneId: "scene",
    });

    const complete = (
      pageKey: string,
      work: {
        attribution: "built" | "cache" | "shared_in_flight";
        commitCpuMs: number;
        queueWaitMs: number;
        workerBuildMs: number;
      },
    ) =>
      recordWorldmapTerrainPageCompletion(metrics, {
        completedAtMs: 20,
        coverage: { fog: true, geometry: true, props: "uploaded" as const },
        fingerprint: `${pageKey}-v1`,
        pageKey,
        revision: 1,
        sceneId: "scene",
        work,
      });
    complete("built", PAGE_WORK);
    complete("cached", { attribution: "cache", commitCpuMs: 1, queueWaitMs: 0, workerBuildMs: 0 });
    complete("shared", {
      attribution: "shared_in_flight",
      commitCpuMs: 1,
      queueWaitMs: 9,
      workerBuildMs: 0,
    });

    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current?.work).toEqual({
      builtPages: 1,
      cachePages: 1,
      commitCpuMs: 4,
      queueWaitMs: 13,
      sharedInFlightPages: 1,
      workerBuildMs: 12,
    });
  });

  it("keeps non-finite observations pending instead of normalizing them to zero", () => {
    const metrics = createWorldmapTerrainPresentationMetrics();
    recordWorldmapTerrainPresentationRequest(metrics, {
      requestedAtMs: Number.NaN,
      revision: 1,
      sceneId: "scene",
    });
    recordWorldmapTerrainSourceReady(metrics, {
      atMs: Number.POSITIVE_INFINITY,
      requestedPages: [{ fingerprint: null, pageKey: "focus" }],
      revision: 1,
      sceneId: "scene",
    });
    recordWorldmapTerrainPageCompletion(metrics, {
      completedAtMs: Number.NaN,
      coverage: { fog: true, geometry: true, props: "stored" },
      fingerprint: "focus-v1",
      pageKey: "focus",
      revision: 1,
      sceneId: "scene",
      work: {
        attribution: "built",
        commitCpuMs: Number.NaN,
        queueWaitMs: Number.POSITIVE_INFINITY,
        workerBuildMs: Number.NaN,
      },
    });
    recordWorldmapTerrainWindowCompletion(metrics, {
      completedAtMs: Number.POSITIVE_INFINITY,
      revision: 1,
      sceneId: "scene",
    });

    expect(snapshotWorldmapTerrainPresentationMetrics(metrics).current).toMatchObject({
      converged: false,
      firstCompletePageAtMs: null,
      requestedAtMs: null,
      sourceReadyAtMs: null,
      windowCompleteAtMs: null,
      work: { commitCpuMs: null, queueWaitMs: null, workerBuildMs: null },
    });
  });
});
