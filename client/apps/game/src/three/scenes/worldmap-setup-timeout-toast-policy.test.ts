import { describe, expect, it } from "vitest";

import { shouldShowSetupTimeoutToast } from "./worldmap-setup-timeout-toast-policy";

describe("shouldShowSetupTimeoutToast", () => {
  it("shows on the first call", () => {
    expect(
      shouldShowSetupTimeoutToast({
        nowMs: 1_000,
        lastShownAtMs: 0,
        throttleMs: 30_000,
        reconnectAttempt: 1,
        lastShownAtAttempt: 0,
      }),
    ).toBe(true);
  });

  it("suppresses within the throttle window when the attempt hasn't changed", () => {
    expect(
      shouldShowSetupTimeoutToast({
        nowMs: 5_000,
        lastShownAtMs: 1_000,
        throttleMs: 30_000,
        reconnectAttempt: 1,
        lastShownAtAttempt: 1,
      }),
    ).toBe(false);
  });

  it("shows again within the throttle window when a NEW reconnect attempt begins", () => {
    expect(
      shouldShowSetupTimeoutToast({
        nowMs: 5_000,
        lastShownAtMs: 1_000,
        throttleMs: 30_000,
        reconnectAttempt: 2,
        lastShownAtAttempt: 1,
      }),
    ).toBe(true);
  });

  it("shows after the throttle window expires even when the attempt is unchanged", () => {
    expect(
      shouldShowSetupTimeoutToast({
        nowMs: 35_000,
        lastShownAtMs: 1_000,
        throttleMs: 30_000,
        reconnectAttempt: 1,
        lastShownAtAttempt: 1,
      }),
    ).toBe(true);
  });

  it("shows when both the throttle window has elapsed AND the attempt changed", () => {
    expect(
      shouldShowSetupTimeoutToast({
        nowMs: 35_000,
        lastShownAtMs: 1_000,
        throttleMs: 30_000,
        reconnectAttempt: 3,
        lastShownAtAttempt: 1,
      }),
    ).toBe(true);
  });
});
