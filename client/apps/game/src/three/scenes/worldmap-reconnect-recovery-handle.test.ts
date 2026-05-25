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

  it("exposes reconnect refresh and connection-failure recovery for the active scene", () => {
    const refreshAfterReconnect = vi.fn();
    const recoverAfterConnectionFailure = vi.fn();
    const cleanup = registerActiveWorldmapRecoveryHandle({ refreshAfterReconnect, recoverAfterConnectionFailure });

    expect(getActiveWorldmapRecoveryHandle()).toEqual({ refreshAfterReconnect, recoverAfterConnectionFailure });
    expect(Object.keys(getActiveWorldmapRecoveryHandle() ?? {})).toEqual([
      "refreshAfterReconnect",
      "recoverAfterConnectionFailure",
    ]);

    cleanup();
    expect(getActiveWorldmapRecoveryHandle()).toBe(null);
  });

  it("does not let stale scene cleanup clear a newer active handle", () => {
    const firstCleanup = registerActiveWorldmapRecoveryHandle({
      refreshAfterReconnect: vi.fn(),
      recoverAfterConnectionFailure: vi.fn(),
    });
    const secondHandle = { refreshAfterReconnect: vi.fn(), recoverAfterConnectionFailure: vi.fn() };

    registerActiveWorldmapRecoveryHandle(secondHandle);
    firstCleanup();

    expect(getActiveWorldmapRecoveryHandle()).toBe(secondHandle);
  });
});
