import { describe, expect, it } from "vitest";
import { createWorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import {
  captureChunkDiagnosticsBaseline,
  cloneChunkDiagnosticsBaselines,
  sanitizeChunkDiagnosticsBaselineLabel,
  snapshotChunkDiagnostics,
  type WorldmapChunkDiagnosticsBaselineEntry,
} from "./worldmap-chunk-diagnostics-baseline";

describe("sanitizeChunkDiagnosticsBaselineLabel", () => {
  it("trims explicit labels", () => {
    expect(sanitizeChunkDiagnosticsBaselineLabel("  before-pan  ")).toBe("before-pan");
  });

  it("falls back to manual when label is empty", () => {
    expect(sanitizeChunkDiagnosticsBaselineLabel("   ")).toBe("manual");
  });

  it("falls back to custom fallback when provided", () => {
    expect(sanitizeChunkDiagnosticsBaselineLabel(undefined, "baseline")).toBe("baseline");
  });
});

describe("snapshotChunkDiagnostics", () => {
  it("returns a clone disconnected from future mutations", () => {
    const diagnostics = createWorldmapChunkDiagnostics();
    diagnostics.switchDurationMsSamples.push(12);
    diagnostics.terrainReadyDurationMsSamples.push(9);
    diagnostics.terrainCommitDurationMsSamples.push(2);
    diagnostics.firstVisibleCommitDurationMsSamples.push(11);
    diagnostics.managerCatchUpDurationMsSamples.push(4);
    const snapshot = snapshotChunkDiagnostics(diagnostics);

    diagnostics.transitionStarted = 5;
    diagnostics.switchDurationMsSamples.push(25);
    diagnostics.terrainReadyDurationMsSamples.push(19);
    diagnostics.terrainCommitDurationMsSamples.push(7);
    diagnostics.firstVisibleCommitDurationMsSamples.push(26);
    diagnostics.managerCatchUpDurationMsSamples.push(10);
    expect(snapshot.transitionStarted).toBe(0);
    expect(snapshot.switchDurationMsSamples).toEqual([12]);
    expect(snapshot.terrainReadyDurationMsSamples).toEqual([9]);
    expect(snapshot.terrainCommitDurationMsSamples).toEqual([2]);
    expect(snapshot.firstVisibleCommitDurationMsSamples).toEqual([11]);
    expect(snapshot.managerCatchUpDurationMsSamples).toEqual([4]);
  });
});

describe("captureChunkDiagnosticsBaseline", () => {
  it("appends a new baseline and clones diagnostics payload", () => {
    const diagnostics = createWorldmapChunkDiagnostics();
    diagnostics.transitionCommitted = 3;

    const result = captureChunkDiagnosticsBaseline({
      baselines: [],
      diagnostics,
      label: "  baseline-a ",
      capturedAtMs: 123,
      maxEntries: 20,
    });

    expect(result.captured.label).toBe("baseline-a");
    expect(result.captured.capturedAtMs).toBe(123);
    expect(result.captured.diagnostics.transitionCommitted).toBe(3);
    expect(result.baselines).toHaveLength(1);

    diagnostics.transitionCommitted = 99;
    expect(result.baselines[0].diagnostics.transitionCommitted).toBe(3);
  });

  it("keeps only the latest maxEntries baselines", () => {
    const makeEntry = (i: number): WorldmapChunkDiagnosticsBaselineEntry => ({
      label: `b-${i}`,
      capturedAtMs: i,
      diagnostics: createWorldmapChunkDiagnostics(),
    });

    const existing = Array.from({ length: 20 }, (_, i) => makeEntry(i + 1));
    const result = captureChunkDiagnosticsBaseline({
      baselines: existing,
      diagnostics: createWorldmapChunkDiagnostics(),
      label: "new",
      capturedAtMs: 21,
      maxEntries: 20,
    });

    expect(result.baselines).toHaveLength(20);
    expect(result.baselines[0].label).toBe("b-2");
    expect(result.baselines[19].label).toBe("new");
  });
});

describe("cloneChunkDiagnosticsBaselines", () => {
  it("clones entry objects and diagnostics payloads", () => {
    const diagnostics = createWorldmapChunkDiagnostics();
    diagnostics.switchDurationMsSamples.push(9);
    diagnostics.firstVisibleCommitDurationMsSamples.push(7);
    const source: WorldmapChunkDiagnosticsBaselineEntry[] = [
      {
        label: "one",
        capturedAtMs: 1,
        diagnostics,
      },
    ];

    const cloned = cloneChunkDiagnosticsBaselines(source);
    expect(cloned).toEqual(source);
    expect(cloned[0]).not.toBe(source[0]);
    expect(cloned[0].diagnostics).not.toBe(source[0].diagnostics);
    expect(cloned[0].diagnostics.switchDurationMsSamples).not.toBe(source[0].diagnostics.switchDurationMsSamples);
    expect(cloned[0].diagnostics.firstVisibleCommitDurationMsSamples).not.toBe(
      source[0].diagnostics.firstVisibleCommitDurationMsSamples,
    );
  });
});
