import type { RendererActiveMode } from "../renderer-backend-v2";

interface RendererGpuTelemetrySnapshot {
  activeMode: RendererActiveMode | null;
  deviceLossMessage: string | null;
  deviceStatus: "lost" | "ready" | "unknown";
  gpuFrameTimeMs: number | null;
  initTimeMs: number | null;
  lastUncapturedErrorMessage: string | null;
  lastUploadLabel: string | null;
  totalUploadBytes: number;
  uncapturedErrorCount: number;
  uploadBytesByLabel: Record<string, number>;
}

const MATRIX_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 16;
const COLOR_UPLOAD_BYTES_PER_INSTANCE = Float32Array.BYTES_PER_ELEMENT * 3;

const createRendererGpuTelemetryState = (): RendererGpuTelemetrySnapshot => ({
  activeMode: null,
  deviceLossMessage: null,
  deviceStatus: "unknown",
  gpuFrameTimeMs: null,
  initTimeMs: null,
  lastUncapturedErrorMessage: null,
  lastUploadLabel: null,
  totalUploadBytes: 0,
  uncapturedErrorCount: 0,
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

export function recordRendererInitTelemetry(input: { activeMode: RendererActiveMode; initTimeMs: number }): void {
  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    activeMode: input.activeMode,
    deviceLossMessage: null,
    deviceStatus: "unknown",
    initTimeMs: input.initTimeMs,
    lastUncapturedErrorMessage: null,
    uncapturedErrorCount: 0,
  };
}

export function markRendererGpuDeviceReady(): void {
  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    deviceLossMessage: null,
    deviceStatus: "ready",
  };
}

export function markRendererGpuDeviceLost(message?: string): void {
  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    deviceLossMessage: message ?? null,
    deviceStatus: "lost",
  };
}

export function recordRendererGpuUncapturedError(message?: string): void {
  rendererGpuTelemetryState = {
    ...rendererGpuTelemetryState,
    lastUncapturedErrorMessage: message ?? null,
    uncapturedErrorCount: rendererGpuTelemetryState.uncapturedErrorCount + 1,
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
