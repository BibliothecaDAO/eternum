import { afterEach, describe, expect, it, vi } from "vitest";

import { clearBiomeGltfCache, getBiomeGltfCacheSize, loadBiomeGltf } from "./biome-gltf-cache";

afterEach(() => {
  clearBiomeGltfCache();
});

describe("loadBiomeGltf", () => {
  // Phase 5.1: each biome GLB was parsed and made GPU-resident twice (Worldmap +
  // Hexception scenes both load the full set). Caching the parsed result per path
  // means the file is parsed once and its geometry/material/textures are shared.
  it("parses each path once and returns the same result for repeated calls", async () => {
    const gltf = { scene: {}, animations: [] };
    const load = vi.fn(async () => gltf);

    const first = await loadBiomeGltf("Grassland.glb", load);
    const second = await loadBiomeGltf("Grassland.glb", load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(gltf);
    expect(second).toBe(gltf);
  });

  it("loads different paths independently", async () => {
    const load = vi.fn(async (path: string) => ({ path }));

    await loadBiomeGltf("Grassland.glb", load);
    await loadBiomeGltf("Ocean.glb", load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares the in-flight promise for concurrent callers", async () => {
    let resolveLoad: (value: { id: number }) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<{ id: number }>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const firstPromise = loadBiomeGltf("Grassland.glb", load);
    const secondPromise = loadBiomeGltf("Grassland.glb", load);
    resolveLoad({ id: 1 });

    expect(load).toHaveBeenCalledTimes(1);
    expect(await firstPromise).toBe(await secondPromise);
  });

  it("evicts a failed load so a later call can retry", async () => {
    const load = vi
      .fn<(path: string) => Promise<{ ok: boolean }>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: true });

    await expect(loadBiomeGltf("Grassland.glb", load)).rejects.toThrow("network");
    await expect(loadBiomeGltf("Grassland.glb", load)).resolves.toEqual({ ok: true });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("clearBiomeGltfCache empties the cache so the next load re-parses", async () => {
    const load = vi.fn(async () => ({}));

    await loadBiomeGltf("Grassland.glb", load);
    expect(getBiomeGltfCacheSize()).toBe(1);

    clearBiomeGltfCache();
    expect(getBiomeGltfCacheSize()).toBe(0);

    await loadBiomeGltf("Grassland.glb", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
