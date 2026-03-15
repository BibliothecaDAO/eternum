import { beforeEach, describe, expect, it } from "vitest";

import {
  recordRendererColorUploadBytes,
  recordRendererGpuFrameTime,
  recordRendererInitTelemetry,
  recordRendererMatrixUploadBytes,
  resetRendererGpuTelemetry,
  snapshotRendererGpuTelemetry,
} from "./renderer-gpu-telemetry";

describe("renderer-gpu-telemetry", () => {
  beforeEach(() => {
    resetRendererGpuTelemetry();
  });

  it("captures init, upload, and gpu timing telemetry in a resettable snapshot", () => {
    recordRendererInitTelemetry({
      activeMode: "webgpu",
      initTimeMs: 24,
    });
    recordRendererGpuFrameTime(3.5);
    recordRendererMatrixUploadBytes(2, "worldmap-cache-replay");
    recordRendererColorUploadBytes(2, "worldmap-cache-replay");

    expect(snapshotRendererGpuTelemetry()).toEqual({
      activeMode: "webgpu",
      deviceLossMessage: null,
      deviceStatus: "unknown",
      gpuFrameTimeMs: 3.5,
      initTimeMs: 24,
      lastUncapturedErrorMessage: null,
      lastUploadLabel: "worldmap-cache-replay",
      totalUploadBytes: 152,
      uncapturedErrorCount: 0,
      uploadBytesByLabel: {
        "worldmap-cache-replay": 152,
      },
    });
  });

  it("resets back to an empty telemetry snapshot", () => {
    recordRendererInitTelemetry({
      activeMode: "webgl2-fallback",
      initTimeMs: 12,
    });
    recordRendererMatrixUploadBytes(1, "cached-world");

    resetRendererGpuTelemetry();

    expect(snapshotRendererGpuTelemetry()).toEqual({
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
  });
});
