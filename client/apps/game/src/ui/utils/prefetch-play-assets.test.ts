// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    document.head.innerHTML = "";
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    stubBrowserPreloadGlobals();
  });

  it("writes a dedicated dashboard session key and batches fetch assets before models and images", async () => {
    const { prefetchDashboardPlayAssets } = await import("./prefetch-play-assets");
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

    vi.useRealTimers();
  });

  it("writes a dedicated entry session key", async () => {
    const { prefetchPlayEntryAssets } = await import("./prefetch-play-assets");
    vi.useFakeTimers();

    prefetchPlayEntryAssets();

    expect(window.sessionStorage.getItem("playEntryAssetsPrefetched")).toBeNull();
    await vi.runAllTimersAsync();
    expect(window.sessionStorage.getItem("playEntryAssetsPrefetched")).toBe("true");

    vi.useRealTimers();
  });

  it("does not duplicate work while a session prefetch is already in flight", async () => {
    const { prefetchDashboardPlayAssets } = await import("./prefetch-play-assets");
    vi.useFakeTimers();

    prefetchDashboardPlayAssets();
    prefetchDashboardPlayAssets();

    await vi.runAllTimersAsync();

    const links = document.head.querySelectorAll('link[rel="prefetch"]');
    expect(links.length).toBeGreaterThan(0);
    expect(window.sessionStorage.getItem("playDashboardAssetsPrefetched")).toBe("true");

    vi.useRealTimers();
  });

  it("is a no-op once the dashboard session key is set", async () => {
    const { prefetchDashboardPlayAssets } = await import("./prefetch-play-assets");
    vi.useFakeTimers();
    window.sessionStorage.setItem("playDashboardAssetsPrefetched", "true");

    prefetchDashboardPlayAssets();
    await vi.runAllTimersAsync();

    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(0);

    vi.useRealTimers();
  });

  it("is a no-op once the entry session key is set", async () => {
    const { prefetchPlayEntryAssets } = await import("./prefetch-play-assets");
    vi.useFakeTimers();
    window.sessionStorage.setItem("playEntryAssetsPrefetched", "true");

    prefetchPlayEntryAssets();
    await vi.runAllTimersAsync();

    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(0);

    vi.useRealTimers();
  });

  it("does not duplicate prefetch links across repeated invocations", async () => {
    const { prefetchDashboardPlayAssets } = await import("./prefetch-play-assets");
    vi.useFakeTimers();

    prefetchDashboardPlayAssets();
    await vi.runAllTimersAsync();

    const firstCount = document.head.querySelectorAll('link[rel="prefetch"]').length;

    window.sessionStorage.removeItem("playDashboardAssetsPrefetched");
    prefetchDashboardPlayAssets();
    await vi.runAllTimersAsync();

    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(firstCount);

    vi.useRealTimers();
  });
});
