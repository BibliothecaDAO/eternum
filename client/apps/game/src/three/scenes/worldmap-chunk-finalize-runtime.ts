import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

interface HandleWorldmapChunkFinalizeResultInput {
  diagnostics: WorldmapChunkDiagnostics;
  finalizeStatus: "rolled_back" | "stale_dropped" | "committed";
  managerCatchUpPromise?: Promise<void> | null;
  onCommitted?: () => Promise<void> | void;
  recordChunkDiagnosticsEvent: (
    diagnostics: WorldmapChunkDiagnostics,
    event: "transition_rolled_back" | "transition_prepare_stale_dropped" | "transition_committed",
  ) => void;
}

export async function handleWorldmapChunkFinalizeResult(
  input: HandleWorldmapChunkFinalizeResultInput,
): Promise<boolean> {
  if (input.finalizeStatus === "rolled_back") {
    input.recordChunkDiagnosticsEvent(input.diagnostics, "transition_rolled_back");
    return false;
  }

  if (input.finalizeStatus === "stale_dropped") {
    input.recordChunkDiagnosticsEvent(input.diagnostics, "transition_prepare_stale_dropped");
    return false;
  }

  input.recordChunkDiagnosticsEvent(input.diagnostics, "transition_committed");

  if (input.managerCatchUpPromise) {
    await input.managerCatchUpPromise;
  }

  await input.onCommitted?.();
  return true;
}
