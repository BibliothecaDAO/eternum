import { describe, expect, it, vi } from "vitest";
import { instrumentGpuBackendHotPaths } from "./gpu-backend-hot-path-instrumentation";

describe("GPU backend hot-path instrumentation", () => {
  it("attributes texture upload time by texture identity and dimensions per report window", () => {
    const texture = {
      image: { width: 512, height: 256 },
      name: "army-morphs",
    };
    const backend = {
      updateTexture: vi.fn(),
    };
    const warn = vi.fn();
    const timestamps = [0, 100, 104, 1_100, 1_106];

    instrumentGpuBackendHotPaths(backend, {
      now: () => timestamps.shift() ?? 1_106,
      reportIntervalMs: 1_000,
      warn,
    });

    backend.updateTexture(texture);
    backend.updateTexture(texture);

    expect(warn).toHaveBeenCalledWith(
      "[GpuBackendPerf] window=1106ms updateTexture=10ms/2x; textures[1]=army-morphs(512x256)=10ms/2x",
    );
  });

  it("does not wrap the same backend twice", () => {
    const updateTexture = vi.fn();
    const backend = { updateTexture };

    instrumentGpuBackendHotPaths(backend);
    const wrapped = backend.updateTexture;
    instrumentGpuBackendHotPaths(backend);

    expect(backend.updateTexture).toBe(wrapped);
  });
});
