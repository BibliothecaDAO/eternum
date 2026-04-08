// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { createBootstrapSession } from "./bootstrap-session";

describe("bootstrap session", () => {
  it("tracks the active selection and reports when a new world requires a reset", async () => {
    const session = createBootstrapSession<string>();
    const execute = vi.fn(async () => "ready");

    const pending = session.run({ chain: "slot", worldName: "alpha" }, execute);

    expect(session.getCachedResult()).toBeNull();
    expect(session.getTrackedSelection()).toEqual({ chain: "slot", worldName: "alpha" });
    expect(session.getResetReason({ chain: "slot", worldName: "beta" })).toBe("world-changed");
    expect(session.getResetReason({ chain: "mainnet", worldName: "alpha" })).toBe("chain-changed");

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
    expect(session.getTrackedSelection()).toEqual({ chain: null, worldName: null });
    expect(session.getCachedResult()).toBeNull();
  });
});
