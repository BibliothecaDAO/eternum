import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";

export interface WorldmapChunkDiagnosticsBaselineEntry {
  label: string;
  capturedAtMs: number;
  diagnostics: WorldmapChunkDiagnostics;
}

interface CaptureChunkDiagnosticsBaselineInput {
  baselines: WorldmapChunkDiagnosticsBaselineEntry[];
  diagnostics: WorldmapChunkDiagnostics;
  label?: string;
  capturedAtMs?: number;
  maxEntries?: number;
}

interface CaptureChunkDiagnosticsBaselineResult {
  captured: WorldmapChunkDiagnosticsBaselineEntry;
  baselines: WorldmapChunkDiagnosticsBaselineEntry[];
}

export function sanitizeChunkDiagnosticsBaselineLabel(label?: string, fallback: string = "manual"): string {
  const candidate = (label ?? fallback).trim();
  return candidate || fallback;
}

export function snapshotChunkDiagnostics(diagnostics: WorldmapChunkDiagnostics): WorldmapChunkDiagnostics {
  return {
    ...diagnostics,
  };
}

export function cloneChunkDiagnosticsBaselines(
  baselines: WorldmapChunkDiagnosticsBaselineEntry[],
): WorldmapChunkDiagnosticsBaselineEntry[] {
  return baselines.map((entry) => ({
    ...entry,
    diagnostics: { ...entry.diagnostics },
  }));
}

export function captureChunkDiagnosticsBaseline(
  input: CaptureChunkDiagnosticsBaselineInput,
): CaptureChunkDiagnosticsBaselineResult {
  const maxEntries = Math.max(1, Math.floor(input.maxEntries ?? 20));
  const captured: WorldmapChunkDiagnosticsBaselineEntry = {
    label: sanitizeChunkDiagnosticsBaselineLabel(input.label),
    capturedAtMs: input.capturedAtMs ?? Date.now(),
    diagnostics: snapshotChunkDiagnostics(input.diagnostics),
  };

  const baselines = [...input.baselines, captured];
  while (baselines.length > maxEntries) {
    baselines.shift();
  }

  return {
    captured: {
      ...captured,
      diagnostics: { ...captured.diagnostics },
    },
    baselines,
  };
}
