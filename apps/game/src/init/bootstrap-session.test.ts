// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createBootstrapSession } from "./bootstrap-session";

describe("bootstrap session", () => {
  it("tracks the active selection and reports when a new world requires a reset", async () => {
    const session = createBootstrapSession<string>();
    const execute = vi.fn(async () => "ready");

    const pending = session.run({ cacheKey: "0x1:7" }, execute);

    expect(session.getCachedResult()).toBeNull();
    expect(session.getTrackedSelection()).toEqual({ cacheKey: "0x1:7" });
    expect(session.getResetReason({ cacheKey: "0x1:8" })).toBe("game-changed");
    expect(session.getResetReason({ cacheKey: "0x2:7" })).toBe("game-changed");
    expect(session.getResetReason({ cacheKey: "0x1:7" })).toBeNull();

    await expect(pending).resolves.toBe("ready");
    expect(session.getCachedResult()).toBe("ready");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("cleans up the previous renderer session when a new cleanup handler replaces it", () => {
    const session = createBootstrapSession<string>();
    const firstCleanup = vi.fn();
    const secondCleanup = vi.fn();

    session.replaceRendererCleanup(firstCleanup);
    session.replaceRendererCleanup(secondCleanup);

    expect(firstCleanup).toHaveBeenCalledTimes(1);

    session.reset();

    expect(secondCleanup).toHaveBeenCalledTimes(1);
    expect(session.getTrackedSelection()).toEqual({ cacheKey: null });
    expect(session.getCachedResult()).toBeNull();
  });
});
