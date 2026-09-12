import { describe, expect, it, vi } from "vitest";

import { recoverChunkLoad } from "./chunk-load-recovery";

function createBrowser() {
  const values = new Map<string, string>();
  return {
    navigator: { onLine: true },
    location: { reload: vi.fn() },
    sessionStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    },
  };
}

describe("deployment chunk recovery", () => {
  it("does not interrupt a pending transaction or consume its recovery attempt", () => {
    const browser = createBrowser();
    recoverChunkLoad(new Event("vite:preloadError"), "release", browser as unknown as Window, true);
    expect(browser.location.reload).not.toHaveBeenCalled();
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
    recoverChunkLoad(new Event("vite:preloadError"), "release", browser as unknown as Window, false);
    expect(browser.location.reload).toHaveBeenCalledTimes(1);
  });
  it("reloads once per version and leaves repeated failures to the crash UI", () => {
    const browser = createBrowser();
    const first = new Event("vite:preloadError", { cancelable: true });
    recoverChunkLoad(first, "release-a", browser as unknown as Window);
    const repeat = new Event("vite:preloadError", { cancelable: true });
    recoverChunkLoad(repeat, "release-a", browser as unknown as Window);
    expect(browser.location.reload).toHaveBeenCalledTimes(1);
    expect(first.defaultPrevented).toBe(true);
    expect(repeat.defaultPrevented).toBe(false);
    recoverChunkLoad(new Event("vite:preloadError"), "release-b", browser as unknown as Window);
    expect(browser.location.reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload offline or when storage is unavailable", () => {
    const browser = createBrowser();
    browser.navigator.onLine = false;
    recoverChunkLoad(new Event("vite:preloadError"), "release", browser as unknown as Window);
    expect(browser.sessionStorage.setItem).not.toHaveBeenCalled();
    browser.navigator.onLine = true;
    browser.sessionStorage.setItem.mockImplementation(() => {
      throw new Error("Storage denied");
    });
    recoverChunkLoad(new Event("vite:preloadError"), "release", browser as unknown as Window);
    expect(browser.location.reload).not.toHaveBeenCalled();
  });
});
