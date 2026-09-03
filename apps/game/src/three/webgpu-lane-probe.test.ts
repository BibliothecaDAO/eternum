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

  it("boots a fresh profile on WebGL2 without waiting for the adapter probe", async () => {
    const storage = createStorage();
    const probe = vi.fn(() => new Promise<"adapter">(() => {}));
    await expect(
      resolveWebGpuLaneStart({ forceReprobe: false, probe, requestedMode: "webgpu-auto", storage }),
    ).resolves.toEqual({
      fallbackReason: "webgpu-unproven",
      forceWebGL: true,
      qualifyAtIdle: true,
      remembered: false,
    });
    expect(probe).not.toHaveBeenCalled();
    expect(readRememberedRendererLane(storage)).toBeNull();
  });

  it("re-probes on an explicit renderer mode without promoting the profile before renderer init", async () => {
    const storage = createStorage({
      [RENDERER_LANE_STORAGE_KEY]: JSON.stringify({ lane: "webgl2", reason: "no-adapter", recordedAt: 1 }),
    });
    const probe = vi.fn(async () => "adapter" as const);
    await expect(
      resolveWebGpuLaneStart({ forceReprobe: true, probe, requestedMode: "webgpu-auto", storage }),
    ).resolves.toEqual({ fallbackReason: null, forceWebGL: false, qualifyAtIdle: false, remembered: false });
    expect(readRememberedRendererLane(storage)).toMatchObject({ lane: "webgl2", reason: "no-adapter" });
  });

  it("keeps an explicit probe timeout soft so renderer init can qualify it at idle", async () => {
    const storage = createStorage();
    await expect(
      resolveWebGpuLaneStart({
        forceReprobe: true,
        probe: async () => "adapter-timeout",
        requestedMode: "webgpu-auto",
        storage,
      }),
    ).resolves.toEqual({
      fallbackReason: "webgpu-probe-timeout",
      forceWebGL: true,
      qualifyAtIdle: true,
      remembered: false,
    });
    expect(readRememberedRendererLane(storage)).toMatchObject({ lane: "webgl2", reason: "adapter-timeout" });
  });

  it("keeps explicit hard verdicts hard", async () => {
    for (const verdict of ["no-adapter", "no-navigator-gpu"] as const) {
      const storage = createStorage();
      await expect(
        resolveWebGpuLaneStart({
          forceReprobe: true,
          probe: async () => verdict,
          requestedMode: "webgpu-auto",
          storage,
        }),
      ).resolves.toEqual({
        fallbackReason: "webgpu-unavailable",
        forceWebGL: true,
        qualifyAtIdle: false,
        remembered: false,
      });
      expect(readRememberedRendererLane(storage)).toMatchObject({ lane: "webgl2", reason: verdict });
    }
  });

  it("asks the backend to qualify a remembered soft fallback at idle", async () => {
    const storage = createStorage({
      [RENDERER_LANE_STORAGE_KEY]: JSON.stringify({ lane: "webgl2", reason: "idle:adapter-timeout", recordedAt: 1 }),
    });
    const probe = vi.fn(async () => "adapter" as const);
    await expect(
      resolveWebGpuLaneStart({
        forceReprobe: false,
        probe,
        requestedMode: "webgpu-auto",
        storage,
      }),
    ).resolves.toMatchObject({ forceWebGL: true, qualifyAtIdle: true, remembered: true });
    expect(probe).not.toHaveBeenCalled();
  });

  it("ignores corrupt memory", () => {
    expect(readRememberedRendererLane(createStorage({ [RENDERER_LANE_STORAGE_KEY]: "{oops" }))).toBeNull();
    expect(readRememberedRendererLane(createStorage({ [RENDERER_LANE_STORAGE_KEY]: '{"lane":"metal"}' }))).toBeNull();
  });
});
