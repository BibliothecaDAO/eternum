import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearActiveWorldmapRecoveryHandle,
  getActiveWorldmapRecoveryHandle,
  registerActiveWorldmapRecoveryHandle,
} from "./worldmap-reconnect-recovery-handle";

describe("worldmap reconnect recovery handle", () => {
  afterEach(() => {
    clearActiveWorldmapRecoveryHandle();
  });

  it("is null-safe when no worldmap scene is active", () => {
    expect(getActiveWorldmapRecoveryHandle()).toBe(null);
  });

  it("exposes only reconnect refresh recovery for the active scene", () => {
    const refreshAfterReconnect = vi.fn();
    const cleanup = registerActiveWorldmapRecoveryHandle({ refreshAfterReconnect });

    expect(getActiveWorldmapRecoveryHandle()).toEqual({ refreshAfterReconnect });
    expect(Object.keys(getActiveWorldmapRecoveryHandle() ?? {})).toEqual(["refreshAfterReconnect"]);

    cleanup();
    expect(getActiveWorldmapRecoveryHandle()).toBe(null);
  });

  it("does not let stale scene cleanup clear a newer active handle", () => {
    const firstCleanup = registerActiveWorldmapRecoveryHandle({ refreshAfterReconnect: vi.fn() });
    const secondHandle = { refreshAfterReconnect: vi.fn() };

    registerActiveWorldmapRecoveryHandle(secondHandle);
    firstCleanup();

    expect(getActiveWorldmapRecoveryHandle()).toBe(secondHandle);
  });
});
