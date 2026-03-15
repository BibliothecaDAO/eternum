import type { RendererActiveMode } from "../renderer-backend-v2";

interface RendererGpuTelemetrySnapshot {
  activeMode: RendererActiveMode | null;
  gpuFrameTimeMs: number | null;
  initTimeMs: number | null;
  lastUploadLabel: string | null;
  totalUploadBytes: number;
  uploadBytesByLabel: Record<string, number>;
}

const MATRIX_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 16;
const COLOR_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 3;

const createRendererGpuTelemetryState = (): RendererGpuTelemetrySnapshot => ({
  activeMode: null,
  gpuFrameTimeMs: null,
  initTimeMs: null,
  lastUploadLabel: null,
  totalUploadBytes: 0,
  uploadBytesByLabel: {},
});

let rendererGpuTelemetryState = createRendererGpuTelemetryState();

function recordRendererUploadBytes(label: string, bytes: number): void {
  const normalizedBytes = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
  if (normalizedBytes === 0) {
    return;
  }

  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    lastUploadLabel: label,
    totalUploadBytes: rendererGpuTelemetryState.totalUploadBytes + normalizedBytes,
    uploadBytesByLabel: {
      ...rendererGpuTelemetryState.uploadBytesByLabel,
      [label]: (rendererGpuTelemetryState.uploadBytesByLabel[label] ?? 0) + normalizedBytes,
    },
  };
}

export function recordRendererInitTelemetry(input: {
  activeMode: RendererActiveMode;
  initTimeMs: number;
}): void {
  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    activeMode: input.activeMode,
    initTimeMs: input.initTimeMs,
  };
}

export function recordRendererGpuFrameTime(durationMs: number): void {
  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    gpuFrameTimeMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : null,
  };
}

export function recordRendererMatrixUploadBytes(instanceCount: number, label: string): void {
  const normalizedCount = Number.isFinite(instanceCount) ? Math.max(0, Math.floor(instanceCount)) : 0;
  recordRendererUploadBytes(label, normalizedCount * MATRIX_UPLOAD_BYTES_PER_INSTANCE);
}

export function recordRendererColorUploadBytes(instanceCount: number, label: string): void {
  const normalizedCount = Number.isFinite(instanceCount) ? Math.max(0, Math.floor(instanceCount)) : 0;
  recordRendererUploadBytes(label, normalizedCount * COLOR_UPLOAD_BYTES_PER_INSTANCE);
}

export function snapshotRendererGpuTelemetry(): RendererGpuTelemetrySnapshot {
  return {
    ...rendererGpuTelemetryState,
    uploadBytesByLabel: { ...rendererGpuTelemetryState.uploadBytesByLabel },
  };
}

export function resetRendererGpuTelemetry(): void {
  rendererGpuTelemetryState = createRendererGpuTelemetryState();
}
