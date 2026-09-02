import { describe, expect, it, vi } from "vitest";

import {
  RENDERER_LANE_STORAGE_KEY,
  probeWebGpuAdapter,
  readRememberedRendererLane,
  resolveWebGpuLaneStart,
} from "./webgpu-lane-probe";

const createStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
};

describe("probeWebGpuAdapter", () => {
  it("answers no-navigator-gpu without a gpu object and no-adapter when the browser has none", async () => {
    await expect(probeWebGpuAdapter({ gpu: undefined })).resolves.toBe("no-navigator-gpu");
    await expect(probeWebGpuAdapter({ gpu: { requestAdapter: async () => null } })).resolves.toBe("no-adapter");
    await expect(probeWebGpuAdapter({ gpu: { requestAdapter: async () => ({}) } })).resolves.toBe("adapter");
  });

  it("times out a request that never answers within the bound", async () => {
    const setTimeoutFn = ((callback: () => void) => {
      callback();
      return 0;
    }) as unknown as typeof setTimeout;
    await expect(
      probeWebGpuAdapter({ gpu: { requestAdapter: () => new Promise(() => {}) }, setTimeoutFn, timeoutMs: 5 }),
    ).resolves.toBe("adapter-timeout");
  });
});

describe("resolveWebGpuLaneStart", () => {
  it("never probes or writes memory when WebGL is forced", async () => {
    const storage = createStorage();
    const probe = vi.fn(async () => "adapter" as const);
    await expect(
      resolveWebGpuLaneStart({ forceReprobe: false, probe, requestedMode: "webgpu-force-webgl", storage }),
    ).resolves.toEqual({ fallbackReason: null, forceWebGL: true, remembered: false });
    expect(probe).not.toHaveBeenCalled();
    expect(storage.getItem(RENDERER_LANE_STORAGE_KEY)).toBeNull();
  });

  it("probes a fresh profile once and remembers the answer", async () => {
    const storage = createStorage();
    const probe = vi.fn(async () => "adapter-timeout" as const);
    await expect(
      resolveWebGpuLaneStart({ forceReprobe: false, probe, requestedMode: "webgpu-auto", storage }),
    ).resolves.toEqual({ fallbackReason: "webgpu-probe-timeout", forceWebGL: true, remembered: false });
    expect(readRememberedRendererLane(storage)).toMatchObject({ lane: "webgl2", reason: "adapter-timeout" });

    await expect(
      resolveWebGpuLaneStart({ forceReprobe: false, probe, requestedMode: "webgpu-auto", storage }),
    ).resolves.toEqual({ fallbackReason: "webgpu-remembered-fallback", forceWebGL: true, remembered: true });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("re-probes on an explicit renderer mode and overwrites the memory", async () => {
    const storage = createStorage({
      [RENDERER_LANE_STORAGE_KEY]: JSON.stringify({ lane: "webgl2", reason: "no-adapter", recordedAt: 1 }),
    });
    const probe = vi.fn(async () => "adapter" as const);
    await expect(
      resolveWebGpuLaneStart({ forceReprobe: true, probe, requestedMode: "webgpu-auto", storage }),
    ).resolves.toEqual({ fallbackReason: null, forceWebGL: false, remembered: false });
    expect(readRememberedRendererLane(storage)).toMatchObject({ lane: "webgpu", reason: "adapter" });
  });

  it("ignores corrupt memory", () => {
    expect(readRememberedRendererLane(createStorage({ [RENDERER_LANE_STORAGE_KEY]: "{oops" }))).toBeNull();
    expect(readRememberedRendererLane(createStorage({ [RENDERER_LANE_STORAGE_KEY]: '{"lane":"metal"}' }))).toBeNull();
  });
});
