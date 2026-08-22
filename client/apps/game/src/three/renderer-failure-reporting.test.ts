import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@sentry/react", () => sentry);

const { reportRendererDeviceLoss, reportRendererFrameFailure, reportRendererRecoveryFailure } =
  await import("./renderer-failure-reporting");

describe("renderer failure reporting", () => {
  beforeEach(() => {
    sentry.captureException.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a structured diagnostic and tagged Sentry frame-error event", () => {
    const error = new RangeError("writeBuffer range is invalid");

    reportRendererFrameFailure(error, {
      activeMode: "webgpu",
      repeatCount: 0,
      sceneName: "map",
    });

    expect(console.error).toHaveBeenCalledWith(
      '[RendererFailure] kind="frame_error" renderer_mode="webgpu" scene="map" repeat_count=0 report_interval=60 error="writeBuffer range is invalid"',
    );
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      fingerprint: ["renderer-frame-error", "webgpu", "RangeError", "writeBuffer range is invalid"],
      tags: {
        "renderer.backend": "webgpu",
        "renderer.failure_kind": "frame_error",
        "renderer.scene": "map",
      },
    });
  });

  it("emits telemetry for every device loss even when recovery is not attempted", () => {
    const event = {
      activeMode: "webgl2-fallback" as const,
      message: "fallback context lost",
    };

    reportRendererDeviceLoss(event, { recoveryAttempted: false });
    reportRendererDeviceLoss(event, { recoveryAttempted: false });

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
    expect(sentry.captureException).toHaveBeenLastCalledWith(expect.any(Error), {
      fingerprint: ["renderer-device-lost", "webgl2-fallback"],
      tags: {
        "renderer.backend": "webgl2-fallback",
        "renderer.failure_kind": "device_lost",
        "renderer.recovery_attempted": "no",
      },
    });
  });

  it("reports fallback initialization failure as a distinct renderer failure", () => {
    const error = new Error("fallback init failed");

    reportRendererRecoveryFailure(error, "webgpu");

    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      fingerprint: ["renderer-recovery-failed", "webgpu", "Error", "fallback init failed"],
      tags: {
        "renderer.backend": "webgpu",
        "renderer.failure_kind": "recovery_failed",
      },
    });
  });
});
