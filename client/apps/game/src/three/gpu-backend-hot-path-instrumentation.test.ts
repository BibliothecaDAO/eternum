import { describe, expect, it, vi } from "vitest";
import {
  getCompiledRenderPipelineCount,
  instrumentGpuBackendHotPaths,
  startGpuBackendFrame,
} from "./gpu-backend-hot-path-instrumentation";
import { runWithFrameWorkOwner } from "./frame-work-owner";

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

  it("counts actual backend render-pipeline compilations directly", () => {
    const backend = { createRenderPipeline: vi.fn() };
    const before = getCompiledRenderPipelineCount();

    instrumentGpuBackendHotPaths(backend, { now: () => 0, reportIntervalMs: 10_000 });
    backend.createRenderPipeline();
    backend.createRenderPipeline();

    expect(getCompiledRenderPipelineCount() - before).toBe(2);
  });

  it("attributes backend work to a single spike frame", () => {
    const texture = {
      image: { width: 1024, height: 1024 },
      name: "structure-label",
    };
    const backend = {
      createAttribute: vi.fn(),
      createRenderPipeline: vi.fn(),
      updateTexture: vi.fn(),
    };
    const warn = vi.fn();
    const timestamps = [0, 1, 13, 14, 20, 21, 26];

    instrumentGpuBackendHotPaths(backend, {
      now: () => timestamps.shift() ?? 26,
      reportIntervalMs: 10_000,
      warn,
    });
    startGpuBackendFrame(0, warn);

    backend.createRenderPipeline();
    backend.createAttribute();
    backend.updateTexture(texture);
    startGpuBackendFrame(87, warn);

    expect(warn).toHaveBeenCalledWith(
      "[GpuBackendPerf] spike 87ms: createRenderPipeline=1x/12ms, createAttribute=1x/6.0ms, updateTexture=1x/5.0ms; textures=structure-label(1024x1024)=1x/5.0ms",
    );
  });

  it("names the dominant ambient owner on a spike frame", () => {
    const warn = vi.fn();

    startGpuBackendFrame(0, warn);
    runWithFrameWorkOwner(
      "catchup:army",
      () => undefined,
      () => 1,
    );
    startGpuBackendFrame(62, warn);

    expect(warn).toHaveBeenCalledWith("[GpuBackendPerf] spike 62ms owner=catchup:army: no GPU backend hot paths");
  });

  it("reports aggregate compile-on-demand cost over the measurement window", () => {
    const backend = {
      createProgram: vi.fn(),
      createRenderPipeline: vi.fn(),
      updateAttribute: vi.fn(),
    };
    const warn = vi.fn();
    const timestamps = [0, 1, 3, 4, 7, 61, 62];

    instrumentGpuBackendHotPaths(backend, {
      compileMeasurementWindowMs: 60,
      now: () => timestamps.shift() ?? 62,
      reportIntervalMs: 10_000,
      warn,
    });
    backend.createRenderPipeline();
    backend.createProgram();
    backend.updateAttribute();

    expect(warn).toHaveBeenCalledWith(
      "[GpuBackendPerf] compile-on-demand window=62ms createRenderPipeline=1x/2.0ms, createProgram=1x/3.0ms",
    );
  });

  it("does no reporting work for a frame within budget and resets samples between frames", () => {
    const backend = {
      createBindings: vi.fn(),
    };
    const warn = vi.fn();
    const timestamps = [1, 3];

    instrumentGpuBackendHotPaths(backend, {
      now: () => timestamps.shift() ?? 3,
      reportIntervalMs: 10_000,
      warn,
    });
    startGpuBackendFrame(0, warn);
    backend.createBindings();

    startGpuBackendFrame(20, warn);
    startGpuBackendFrame(60, warn);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith("[GpuBackendPerf] spike 40ms: no GPU backend hot paths");
  });
});
