import { describe, expect, it } from "vitest";

import { resolveAutoSettleRuntimeState, type AutoSettleRuntimeInput } from "./auto-settle-runtime";

const createInput = (overrides: Partial<AutoSettleRuntimeInput> = {}): AutoSettleRuntimeInput => ({
  enabled: true,
  persistedStatus: "armed",
  unlockAtSec: 130,
  nowSec: 100,
  hasConnectedWallet: true,
  hasCompatibleNetwork: true,
  ...overrides,
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

  it("opens the entry route exactly when the countdown reaches settlement time", () => {
    expect(resolveAutoSettleRuntimeState(createInput({ nowSec: 130 }))).toMatchObject({
      phase: "opening",
      shouldOpenEntry: true,
      shouldRefreshAvailability: true,
    });
  });

  it("stays armed while the visible game countdown is still running", () => {
    expect(resolveAutoSettleRuntimeState(createInput({ nowSec: 124 }))).toMatchObject({
      phase: "prewarming",
      shouldOpenEntry: false,
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
