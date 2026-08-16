// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordRendererStartupTiming,
  resetRendererStartupTimings,
  snapshotRendererStartupTimings,
} from "./renderer-startup-telemetry";

const recordGameEntryDuration = vi.fn();

vi.mock("@/ui/layouts/game-entry-timeline", () => ({
  recordGameEntryDuration: (name: string, durationMs: number) => recordGameEntryDuration(name, durationMs),
}));

describe("renderer startup telemetry", () => {
  beforeEach(() => {
    resetRendererStartupTimings();
    recordGameEntryDuration.mockClear();
  });

  afterEach(() => {
    resetRendererStartupTimings();
  });

  it("records startup timings into diagnostics and the boot timeline", () => {
    recordRendererStartupTiming("webgpu-module-import", 12.7);
    recordRendererStartupTiming("webgpu-renderer-init", 20.2);

    expect(snapshotRendererStartupTimings()).toEqual({
      "webgpu-module-import": 13,
      "webgpu-renderer-init": 20,
    });
    expect(recordGameEntryDuration).toHaveBeenNthCalledWith(1, "renderer-init-webgpu-module-import", 13);
    expect(recordGameEntryDuration).toHaveBeenNthCalledWith(2, "renderer-init-webgpu-renderer-init", 20);
  });

  it("ignores non-finite and negative timings", () => {
    recordRendererStartupTiming("webgpu-backend-total", Number.NaN);
    recordRendererStartupTiming("webgpu-renderer-create", -10);

    expect(snapshotRendererStartupTimings()).toEqual({});
    expect(recordGameEntryDuration).not.toHaveBeenCalled();
  });
});
