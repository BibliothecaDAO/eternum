import { describe, expect, it, vi } from "vitest";

import { handleWorldmapChunkFinalizeResult } from "./worldmap-chunk-finalize-runtime";

describe("handleWorldmapChunkFinalizeResult", () => {
  it("records rollback and skips follow-up work", async () => {
    const recordChunkDiagnosticsEvent = vi.fn();
    const onCommitted = vi.fn();

    const result = await handleWorldmapChunkFinalizeResult({
      finalizeStatus: "rolled_back",
      onCommitted,
      recordChunkDiagnosticsEvent,
      diagnostics: { id: "diagnostics" } as never,
    });

    expect(result).toBe(false);
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "transition_rolled_back");
    expect(onCommitted).not.toHaveBeenCalled();
  });

  it("records stale drops and skips follow-up work", async () => {
    const recordChunkDiagnosticsEvent = vi.fn();
    const onCommitted = vi.fn();

    const result = await handleWorldmapChunkFinalizeResult({
      finalizeStatus: "stale_dropped",
      onCommitted,
      recordChunkDiagnosticsEvent,
      diagnostics: { id: "diagnostics" } as never,
    });

    expect(result).toBe(false);
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "transition_prepare_stale_dropped");
    expect(onCommitted).not.toHaveBeenCalled();
  });

  it("records committed transitions and awaits follow-up work", async () => {
    const recordChunkDiagnosticsEvent = vi.fn();
    const managerCatchUpPromise = Promise.resolve();
    const onCommitted = vi.fn(async () => undefined);

    const result = await handleWorldmapChunkFinalizeResult({
      finalizeStatus: "committed",
      managerCatchUpPromise,
      onCommitted,
      recordChunkDiagnosticsEvent,
      diagnostics: { id: "diagnostics" } as never,
    });

    expect(result).toBe(true);
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "transition_committed");
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });
});
