// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const importDevMode = async () => {
  vi.resetModules();
  return import("./dev-mode");
};

describe("developer mode", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("is off in every build until the page asks for it: no build setting turns it on", async () => {
    vi.stubEnv("VITE_PUBLIC_GRAPHICS_DEV", "true");

    const { DEV_MODE_ENABLED } = await importDevMode();

    expect(DEV_MODE_ENABLED).toBe(false);
  });

  it("is turned on by ?dev and kept for the browser, until ?dev=0 clears it", async () => {
    window.history.replaceState({}, "", "/lab?dev");
    expect((await importDevMode()).DEV_MODE_ENABLED).toBe(true);

    window.history.replaceState({}, "", "/play/map");
    expect((await importDevMode()).DEV_MODE_ENABLED).toBe(true);

    window.history.replaceState({}, "", "/play/map?dev=0");
    expect((await importDevMode()).DEV_MODE_ENABLED).toBe(false);

    window.history.replaceState({}, "", "/play/map");
    expect((await importDevMode()).DEV_MODE_ENABLED).toBe(false);
  });
});

describe("verbose logging mode", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("enables logs only for the current URL", async () => {
    window.history.replaceState({}, "", "/play/map?logs=1");

    const { VERBOSE_LOGS_ENABLED } = await importDevMode();

    expect(VERBOSE_LOGS_ENABLED).toBe(true);
    expect(window.localStorage.length).toBe(0);
  });

  it("does not restore the retired persistent logs preference", async () => {
    window.localStorage.setItem("eternum:verbose-logs", "1");

    const { VERBOSE_LOGS_ENABLED } = await importDevMode();

    expect(VERBOSE_LOGS_ENABLED).toBe(false);
  });
});
