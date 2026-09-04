// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../env", () => ({
  env: { VITE_PUBLIC_GRAPHICS_DEV: false },
}));

const importDevMode = async () => {
  vi.resetModules();
  return import("./dev-mode");
};

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
