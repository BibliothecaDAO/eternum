import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearActiveWorldmapRecoveryHandle,
  getActiveWorldmapRecoveryHandle,
  registerActiveWorldmapRecoveryHandle,
} from "./worldmap-reconnect-recovery-handle";

const makeHandle = () => ({
  refreshAfterReconnect: vi.fn(),
  recoverAfterConnectionFailure: vi.fn(),
});

describe("worldmap reconnect recovery handle", () => {
  afterEach(() => {
    clearActiveWorldmapRecoveryHandle();
  });

  it("is null-safe when no worldmap scene is active", () => {
    expect(getActiveWorldmapRecoveryHandle()).toBe(null);
  });

  it("exposes reconnect refresh and connection-failure recovery for the active scene", () => {
    const handle = makeHandle();
    const cleanup = registerActiveWorldmapRecoveryHandle(handle);

    expect(getActiveWorldmapRecoveryHandle()).toEqual(handle);
    expect(Object.keys(getActiveWorldmapRecoveryHandle() ?? {})).toEqual([
      "refreshAfterReconnect",
      "recoverAfterConnectionFailure",
    ]);

    cleanup();
    expect(getActiveWorldmapRecoveryHandle()).toBe(null);
  });

  it("does not let stale scene cleanup clear a newer active handle", () => {
    const firstCleanup = registerActiveWorldmapRecoveryHandle(makeHandle());
    const secondHandle = makeHandle();

    registerActiveWorldmapRecoveryHandle(secondHandle);
    firstCleanup();

    expect(getActiveWorldmapRecoveryHandle()).toBe(secondHandle);
  });
});
