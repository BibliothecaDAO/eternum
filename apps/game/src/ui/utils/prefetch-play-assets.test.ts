// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as prefetchPlayAssetsModule from "./prefetch-play-assets";

const stubBrowserPreloadGlobals = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      json: async () => ({}),
      ok: true,
    })),
  );

  Object.defineProperty(navigator, "getBattery", {
    configurable: true,
    value: vi.fn(async () => ({ charging: true })),
  });
};

describe("prefetch-play-assets", () => {
  let prefetchDashboardPlayAssets: typeof prefetchPlayAssetsModule.prefetchDashboardPlayAssets;
  let prefetchPlayEntryAssets: typeof prefetchPlayAssetsModule.prefetchPlayEntryAssets;

  beforeAll(async () => {
    stubBrowserPreloadGlobals();
    const module = await import("./prefetch-play-assets");
    prefetchDashboardPlayAssets = module.prefetchDashboardPlayAssets;
    prefetchPlayEntryAssets = module.prefetchPlayEntryAssets;
  });

  beforeEach(() => {
    document.head.innerHTML = "";
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    stubBrowserPreloadGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes a dedicated dashboard session key and batches fetch assets before models and images", async () => {
    vi.useFakeTimers();

    prefetchDashboardPlayAssets();

    expect(window.sessionStorage.getItem("playDashboardAssetsPrefetched")).toBeNull();

    await vi.runOnlyPendingTimersAsync();
    const afterFetchBatch = Array.from(document.head.querySelectorAll('link[rel="prefetch"]')).map((node) =>
      node.getAttribute("href"),
    );
    expect(afterFetchBatch).toContain("/textures/environment/models_env.hdr");
    expect(afterFetchBatch?.[0]).toBe("/textures/environment/models_env.hdr");

    await vi.runOnlyPendingTimersAsync();
    const afterModelBatch = Array.from(document.head.querySelectorAll('link[rel="prefetch"]')).map((node) =>
      node.getAttribute("href"),
    );
    expect(afterModelBatch.some((href) => href?.endsWith(".glb"))).toBe(true);

    await vi.runAllTimersAsync();
    expect(window.sessionStorage.getItem("playDashboardAssetsPrefetched")).toBe("true");
    const allPrefetched = Array.from(document.head.querySelectorAll('link[rel="prefetch"]')).map((node) =>
      node.getAttribute("href"),
    );
    expect(allPrefetched.some((href) => href?.endsWith(".png") || href?.endsWith(".svg"))).toBe(true);
  });

  it("writes a dedicated entry session key", async () => {
    vi.useFakeTimers();

    prefetchPlayEntryAssets();

    expect(window.sessionStorage.getItem("playEntryAssetsPrefetched")).toBeNull();
    await vi.runAllTimersAsync();
    expect(window.sessionStorage.getItem("playEntryAssetsPrefetched")).toBe("true");
  });

  it("does not duplicate work while a session prefetch is already in flight", async () => {
    vi.useFakeTimers();

    prefetchDashboardPlayAssets();
    prefetchDashboardPlayAssets();

    await vi.runAllTimersAsync();

    const links = document.head.querySelectorAll('link[rel="prefetch"]');
    expect(links.length).toBeGreaterThan(0);
    expect(window.sessionStorage.getItem("playDashboardAssetsPrefetched")).toBe("true");
  });

  it("is a no-op once the dashboard session key is set", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem("playDashboardAssetsPrefetched", "true");

    prefetchDashboardPlayAssets();
    await vi.runAllTimersAsync();

    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(0);
  });

  it("is a no-op once the entry session key is set", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem("playEntryAssetsPrefetched", "true");

    prefetchPlayEntryAssets();
    await vi.runAllTimersAsync();

    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(0);
  });

  it("does not duplicate prefetch links across repeated invocations", async () => {
    vi.useFakeTimers();

    prefetchDashboardPlayAssets();
    await vi.runAllTimersAsync();

    const firstCount = document.head.querySelectorAll('link[rel="prefetch"]').length;

    window.sessionStorage.removeItem("playDashboardAssetsPrefetched");
    prefetchDashboardPlayAssets();
    await vi.runAllTimersAsync();

    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(firstCount);
  });
});
