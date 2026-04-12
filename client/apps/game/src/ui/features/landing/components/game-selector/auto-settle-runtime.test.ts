import { describe, expect, it } from "vitest";

import {
  resolveAutoSettleRuntimeState,
  resolveAutoSettleTriggerAtSec,
  type AutoSettleRuntimeInput,
} from "./auto-settle-runtime";

const createInput = (overrides: Partial<AutoSettleRuntimeInput> = {}): AutoSettleRuntimeInput => ({
  enabled: true,
  persistedStatus: "armed",
  triggerAtSec: 130,
  nowSec: 100,
  hasConnectedWallet: true,
  hasCompatibleNetwork: true,
  ...overrides,
});

describe("resolveAutoSettleTriggerAtSec", () => {
  it("uses the main game start as the auto-open boundary when it is available", () => {
    expect(
      resolveAutoSettleTriggerAtSec({
        startSettlingAt: 130,
        startMainAt: 160,
      }),
    ).toBe(160);
  });

  it("falls back to settlement start when main start is unavailable", () => {
    expect(
      resolveAutoSettleTriggerAtSec({
        startSettlingAt: 130,
        startMainAt: null,
      }),
    ).toBe(130);
  });
});

describe("resolveAutoSettleRuntimeState", () => {
  it("enters the prewarm window shortly before settlement opens", () => {
    expect(resolveAutoSettleRuntimeState(createInput({ nowSec: 105 }))).toMatchObject({
      phase: "prewarming",
      shouldPrimeAssets: true,
      shouldOpenEntry: false,
    });
  });

  it("pauses at the deadline when the wallet is disconnected", () => {
    expect(
      resolveAutoSettleRuntimeState(
        createInput({
          nowSec: 130,
          hasConnectedWallet: false,
        }),
      ),
    ).toMatchObject({
      phase: "paused-wallet",
      shouldOpenEntry: false,
    });
  });

  it("pauses at the deadline when the wallet network is not ready", () => {
    expect(
      resolveAutoSettleRuntimeState(
        createInput({
          nowSec: 130,
          hasCompatibleNetwork: false,
        }),
      ),
    ).toMatchObject({
      phase: "paused-network",
      shouldOpenEntry: false,
    });
  });

  it("opens the entry route exactly when the main game start is reached", () => {
    expect(resolveAutoSettleRuntimeState(createInput({ nowSec: 130 }))).toMatchObject({
      phase: "opening",
      shouldOpenEntry: true,
      shouldRefreshAvailability: true,
    });
  });

  it("stops automatic reopening after a failed attempt until the user intervenes", () => {
    expect(
      resolveAutoSettleRuntimeState(
        createInput({
          nowSec: 150,
          persistedStatus: "failed",
        }),
      ),
    ).toMatchObject({
      phase: "failed",
      shouldOpenEntry: false,
    });
  });
});
