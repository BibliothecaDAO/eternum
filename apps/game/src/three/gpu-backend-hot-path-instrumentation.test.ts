// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  discardGpuBackendFrame,
  getCompiledRenderPipelineCount,
  instrumentGpuBackendHotPaths,
  startGpuBackendFrame,
} from "./gpu-backend-hot-path-instrumentation";
import { runWithFrameWorkOwner } from "./frame-work-owner";

const startFrame = (
  startedAt: number,
  warn: (message: string) => void,
  gpuAttributionEnabled: boolean = true,
  rendererMode: string = "webgpu",
) => startGpuBackendFrame({ gpuAttributionEnabled, pageVisible: true, rendererMode, startedAt, warn });

describe("GPU backend hot-path instrumentation", () => {
  beforeEach(() => {
    startGpuBackendFrame({ pageVisible: false });
  });

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
      emitWindowReports: true,
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
    startFrame(0, warn);

    backend.createRenderPipeline();
    backend.createAttribute();
    backend.updateTexture(texture);
    startFrame(87, warn);

    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=87 frame_owner=unattributed gpu_attribution=enabled gpu_backend_ms=23 attribution=material gpu_contributors=createRenderPipeline=1x/12ms, createAttribute=1x/6.0ms, updateTexture=1x/5.0ms gpu_textures=structure-label(1024x1024)=1x/5.0ms",
    );
  });

  it("names the dominant ambient owner on a spike frame", () => {
    const warn = vi.fn();

    startFrame(0, warn);
    runWithFrameWorkOwner(
      "catchup:army",
      () => undefined,
      () => 1,
    );
    startFrame(62, warn);

    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=62 frame_owner=catchup:army owner_ms=0 owner_max_ms=0 gpu_attribution=enabled gpu_backend_ms=0 attribution=cpu-bound",
    );
  });

  it("summarizes immaterial GPU work as cpu-bound instead of listing calls", () => {
    const backend = { updateAttribute: vi.fn() };
    const warn = vi.fn();
    const timestamps = [0, 1, 3];

    instrumentGpuBackendHotPaths(backend, {
      now: () => timestamps.shift() ?? 3,
      reportIntervalMs: 10_000,
      warn,
    });
    startFrame(0, warn);
    backend.updateAttribute();
    startFrame(120, warn);

    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=120 frame_owner=unattributed gpu_attribution=enabled gpu_backend_ms=2.0 attribution=cpu-bound",
    );
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
    startFrame(0, warn);
    backend.createBindings();

    startFrame(20, warn);
    startFrame(60, warn);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=40 frame_owner=unattributed gpu_attribution=enabled gpu_backend_ms=0 attribution=cpu-bound",
    );
  });

  it("reports a production spike without claiming CPU attribution when backend instrumentation is disabled", () => {
    const warn = vi.fn();

    startFrame(0, warn, false, "webgl2-fallback");
    startFrame(80, warn, false, "webgl2-fallback");

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgl2-fallback duration_ms=80 frame_owner=unattributed gpu_attribution=disabled",
    );
    expect(warn.mock.calls[0][0]).not.toContain("cpu-bound");
  });

  it("digests production spike frames into one console line per window", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const frame = (startedAt: number) =>
      startGpuBackendFrame({ gpuAttributionEnabled: false, pageVisible: true, rendererMode: "webgpu", startedAt });

    frame(0);
    frame(40);
    frame(100);
    expect(consoleWarn).not.toHaveBeenCalled();

    discardGpuBackendFrame();
    frame(10_000);
    frame(10_050);
    expect(consoleWarn).toHaveBeenCalledOnce();
    expect(consoleWarn.mock.calls[0][0]).toBe(
      "[FramePerf] 3 spike frames in 10.0s, worst 60ms — [FramePerf] spike renderer_mode=webgpu duration_ms=60 frame_owner=unattributed gpu_attribution=disabled",
    );

    frame(12_000);
    expect(consoleWarn).toHaveBeenCalledTimes(2);
    expect(consoleWarn.mock.calls[1][0]).toContain("duration_ms=1950");
    consoleWarn.mockRestore();
    discardGpuBackendFrame();
  });

  it("discards expected animation throttling while the page is hidden", () => {
    const warn = vi.fn();

    startFrame(0, warn, false);
    startGpuBackendFrame({ pageVisible: false, startedAt: 1_000, warn });
    startFrame(2_000, warn, false);

    expect(warn).not.toHaveBeenCalled();
  });

  it("discards an active sample as soon as the page becomes hidden", () => {
    const warn = vi.fn();
    const visibilityState = vi.spyOn(document, "visibilityState", "get");
    visibilityState.mockReturnValue("visible");
    startFrame(0, warn, false);

    visibilityState.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    visibilityState.mockReturnValue("visible");
    startFrame(2_000, warn, false);
    startFrame(2_040, warn, false);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=40 frame_owner=unattributed gpu_attribution=disabled",
    );
    visibilityState.mockRestore();
  });

  it("discards an active sample without changing ordinary frame reporting", () => {
    const warn = vi.fn();

    startFrame(0, warn, false);
    discardGpuBackendFrame();
    startFrame(1_000, warn, false);
    startFrame(1_040, warn, false);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "[FramePerf] spike renderer_mode=webgpu duration_ms=40 frame_owner=unattributed gpu_attribution=disabled",
    );
  });
});
