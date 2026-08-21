import { DataTexture, RGBAFormat, Texture, UnsignedByteType } from "three";
import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_TEXTURE_PREWARM_INTERACTION_DEADLINE_MS,
  LOCAL_TEXTURE_PREWARM_MAX_ESTIMATED_BYTES,
  LOCAL_TEXTURE_PREWARM_MAX_RESIDENT_TEXTURES,
  createLocalViewTexturePrewarm,
  estimateTextureUploadBytes,
  formatLocalTexturePrewarmReport,
  resolveLocalTexturePrewarmPolicy,
  type LocalTexturePrewarmReport,
} from "./local-view-texture-prewarm";

describe("local-view texture prewarm policy", () => {
  it.each([
    [{ isMobileDevice: true }, "mobile_device"],
    [{ renderMode: "battery" as const }, "battery_mode"],
    [{ deviceMemoryGb: 4 }, "low_device_memory"],
    [{ residentTextureCount: LOCAL_TEXTURE_PREWARM_MAX_RESIDENT_TEXTURES }, "resident_texture_budget_exceeded"],
    [{ estimatedBytes: LOCAL_TEXTURE_PREWARM_MAX_ESTIMATED_BYTES + 1 }, "memory_budget_exceeded"],
    [{ hasIdleScheduler: false }, "idle_scheduler_unavailable"],
    [{ supportsTextureUpload: false }, "texture_upload_unsupported"],
  ])("rejects %s", (override, reason) => {
    expect(
      resolveLocalTexturePrewarmPolicy({
        deviceMemoryGb: 16,
        estimatedBytes: 1024,
        hasIdleScheduler: true,
        isMobileDevice: false,
        residentTextureCount: 0,
        renderMode: "quality",
        supportsTextureUpload: true,
        ...override,
      }),
    ).toEqual({ allowed: false, reason });
  });

  it("allows a bounded desktop quality-mode upload", () => {
    expect(LOCAL_TEXTURE_PREWARM_MAX_ESTIMATED_BYTES).toBe(64 * 1024 * 1024);
    expect(
      resolveLocalTexturePrewarmPolicy({
        deviceMemoryGb: 16,
        estimatedBytes: 1024,
        hasIdleScheduler: true,
        isMobileDevice: false,
        residentTextureCount: 0,
        renderMode: "quality",
        supportsTextureUpload: true,
      }),
    ).toEqual({ allowed: true });
  });
});

describe("local-view texture prewarm runtime", () => {
  it("uploads one unique texture per idle turn and reports upload/memory cost", async () => {
    const first = createImageTexture(8, 8);
    const second = createImageTexture(16, 16);
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    const rendererInfo = createRendererInfo();
    let clock = 100;
    const uploadTexture = vi.fn((_texture: Texture) => {
      clock += 5;
      rendererInfo.memory.textures += 1;
    });
    const controller = createLocalViewTexturePrewarm({
      deviceMemoryGb: 16,
      getRendererInfo: () => rendererInfo,
      hasRecentInteraction: () => false,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => true,
      now: () => clock,
      onError: vi.fn(),
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: async () => [first, first, second],
      scheduler,
      uploadTexture,
    });

    controller.start();
    await Promise.resolve();
    scheduler.runNext();
    expect(uploadTexture).toHaveBeenCalledTimes(1);
    scheduler.runNext();

    expect(uploadTexture.mock.calls.map(([texture]) => texture)).toEqual([first, second]);
    expect(reports).toEqual([
      expect.objectContaining({
        gpuTextureDelta: 2,
        status: "completed",
        textureCount: 2,
        uploadMs: 10,
      }),
    ]);
  });

  it("defers while interaction is recent", async () => {
    const scheduler = createIdleSchedulerHarness();
    let interacting = true;
    const uploadTexture = vi.fn();
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: createRendererInfo,
      hasRecentInteraction: () => interacting,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => true,
      onError: vi.fn(),
      onReport: vi.fn(),
      renderMode: "quality",
      resolveTextures: async () => [createImageTexture(8, 8)],
      scheduler,
      uploadTexture,
    });

    controller.start();
    await Promise.resolve();
    scheduler.runNext();
    expect(uploadTexture).not.toHaveBeenCalled();

    interacting = false;
    scheduler.runNext();
    expect(uploadTexture).toHaveBeenCalledOnce();
  });

  it("stops deferring when interaction consumes the prewarm deadline", async () => {
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    let clock = 0;
    const uploadTexture = vi.fn();
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: createRendererInfo,
      hasRecentInteraction: () => true,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => true,
      now: () => clock,
      onError: vi.fn(),
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: async () => [createImageTexture(8, 8)],
      scheduler,
      uploadTexture,
    });

    controller.start();
    await Promise.resolve();
    scheduler.runNext();
    expect(scheduler.pendingCount()).toBe(1);

    clock = LOCAL_TEXTURE_PREWARM_INTERACTION_DEADLINE_MS;
    scheduler.runNext();

    expect(uploadTexture).not.toHaveBeenCalled();
    expect(scheduler.pendingCount()).toBe(0);
    expect(reports).toEqual([
      expect.objectContaining({ reason: "interaction_deadline_exceeded", status: "cancelled" }),
    ]);
  });

  it("stops when the renderer reaches the resident texture budget", async () => {
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    const rendererInfo = createRendererInfo();
    const uploadTexture = vi.fn();
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: () => rendererInfo,
      hasRecentInteraction: () => false,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => true,
      onError: vi.fn(),
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: async () => [createImageTexture(8, 8)],
      scheduler,
      uploadTexture,
    });

    controller.start();
    await Promise.resolve();
    rendererInfo.memory.textures = LOCAL_TEXTURE_PREWARM_MAX_RESIDENT_TEXTURES;
    scheduler.runNext();

    expect(uploadTexture).not.toHaveBeenCalled();
    expect(reports).toEqual([
      expect.objectContaining({ reason: "resident_texture_budget_exceeded", status: "cancelled" }),
    ]);
  });

  it("cancels a pending model wait before an idle upload can be scheduled", async () => {
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    let resolveTextures!: (textures: Texture[]) => void;
    const textures = new Promise<Texture[]>((resolve) => {
      resolveTextures = resolve;
    });
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: createRendererInfo,
      hasRecentInteraction: () => false,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => true,
      onError: vi.fn(),
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: () => textures,
      scheduler,
      uploadTexture: vi.fn(),
    });

    controller.start();
    controller.cancel("page_hidden");
    resolveTextures([createImageTexture(8, 8)]);
    await textures;
    await Promise.resolve();

    expect(scheduler.pendingCount()).toBe(0);
    expect(reports).toEqual([expect.objectContaining({ reason: "page_hidden", status: "cancelled" })]);
  });

  it("removes scheduled idle work when the renderer is destroyed", async () => {
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    const uploadTexture = vi.fn();
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: createRendererInfo,
      hasRecentInteraction: () => false,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => true,
      onError: vi.fn(),
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: async () => [createImageTexture(8, 8)],
      scheduler,
      uploadTexture,
    });

    controller.start();
    await Promise.resolve();
    expect(scheduler.pendingCount()).toBe(1);

    controller.cancel("renderer_destroyed");

    expect(scheduler.pendingCount()).toBe(0);
    expect(uploadTexture).not.toHaveBeenCalled();
    expect(reports).toEqual([expect.objectContaining({ reason: "renderer_destroyed", status: "cancelled" })]);
  });

  it("cancels instead of competing with the first local scene transition", async () => {
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: createRendererInfo,
      hasRecentInteraction: () => false,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => false,
      onError: vi.fn(),
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: async () => [createImageTexture(8, 8)],
      scheduler,
      uploadTexture: vi.fn(),
    });

    controller.start();
    await Promise.resolve();
    scheduler.runNext();

    expect(reports).toEqual([expect.objectContaining({ reason: "scene_changed", status: "cancelled" })]);
  });

  it("reports a throwing worldmap guard without stranding the controller", async () => {
    const scheduler = createIdleSchedulerHarness();
    const reports: LocalTexturePrewarmReport[] = [];
    const guardError = new Error("scene lookup failed");
    const onError = vi.fn();
    const controller = createLocalViewTexturePrewarm({
      getRendererInfo: createRendererInfo,
      hasRecentInteraction: () => false,
      isMobileDevice: false,
      isOwnerActive: () => true,
      isWorldmapActive: () => {
        throw guardError;
      },
      onError,
      onReport: (report) => reports.push(report),
      renderMode: "quality",
      resolveTextures: async () => [createImageTexture(8, 8)],
      scheduler,
      uploadTexture: vi.fn(),
    });

    controller.start();
    await Promise.resolve();
    scheduler.runNext();

    expect(onError).toHaveBeenCalledWith(guardError);
    expect(scheduler.pendingCount()).toBe(0);
    expect(reports).toEqual([expect.objectContaining({ status: "failed" })]);
  });
});

describe("local-view texture prewarm diagnostics", () => {
  it("estimates typed texture data and formats one machine-readable line", () => {
    const texture = new DataTexture(new Uint8Array(4 * 8 * 8), 8, 8, RGBAFormat, UnsignedByteType);
    texture.generateMipmaps = false;

    expect(estimateTextureUploadBytes(texture)).toBe(256);
    expect(
      formatLocalTexturePrewarmReport({
        elapsedMs: 25,
        estimatedBytes: 1024 * 1024,
        gpuTextureDelta: 2,
        status: "completed",
        textureCount: 3,
        uploadMs: 12,
      }),
    ).toBe(
      "[LocalTexturePrewarm] status=completed textures=3 upload_ms=12 elapsed_ms=25 estimated_mb=1.0 gpu_textures_delta=2",
    );
  });
});

function createImageTexture(width: number, height: number): Texture {
  const texture = new Texture({ width, height });
  texture.generateMipmaps = false;
  return texture;
}

function createRendererInfo() {
  return {
    memory: { geometries: 0, textures: 0 },
    render: { calls: 0, triangles: 0 },
    reset: vi.fn(),
  };
}

function createIdleSchedulerHarness() {
  let nextHandle = 1;
  const pending = new Map<number, () => void>();

  return {
    cancel(handle: number) {
      pending.delete(handle);
    },
    pendingCount: () => pending.size,
    runNext() {
      const entry = pending.entries().next().value as [number, () => void] | undefined;
      if (!entry) throw new Error("No idle task is pending");
      pending.delete(entry[0]);
      entry[1]();
    },
    schedule(work: () => void) {
      const handle = nextHandle++;
      pending.set(handle, work);
      return handle;
    },
  };
}
