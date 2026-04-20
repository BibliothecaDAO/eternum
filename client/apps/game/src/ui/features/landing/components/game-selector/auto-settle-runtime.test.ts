import { describe, expect, it } from "vitest";

import { resolveAutoSettleRuntimeState, type AutoSettleRuntimeInput } from "./auto-settle-runtime";

const createInput = (overrides: Partial<AutoSettleRuntimeInput> = {}): AutoSettleRuntimeInput => ({
  enabled: true,
  persistedStatus: "armed",
  unlockAtSec: 130,
  nowSec: 100,
  opensOnUnlockEdge: true,
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

  it("waits for onchain settlement time after the visible countdown reaches settlement time", () => {
    expect(resolveAutoSettleRuntimeState(createInput({ nowSec: 130 }))).toMatchObject({
      phase: "prewarming",
      shouldOpenEntry: false,
      shouldRefreshAvailability: true,
    });
  });

  it("opens the entry route after the onchain settlement delay", () => {
    expect(resolveAutoSettleRuntimeState(createInput({ nowSec: 132 }))).toMatchObject({
      phase: "opening",
      shouldOpenEntry: true,
      shouldRefreshAvailability: true,
    });
  });

  it("keeps auto-settle armed without auto-opening when the entry was armed after unlock", () => {
    expect(
      resolveAutoSettleRuntimeState(
        createInput({
          nowSec: 130,
          opensOnUnlockEdge: false,
        }),
      ),
    ).toMatchObject({
      phase: "ready-manual",
      shouldOpenEntry: false,
      shouldPrimeAssets: false,
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

  it("keeps paused wallet/network logic for unlock-edge armed entries", () => {
    expect(
      resolveAutoSettleRuntimeState(
        createInput({
          nowSec: 130,
          opensOnUnlockEdge: true,
          hasConnectedWallet: false,
        }),
      ),
    ).toMatchObject({
      phase: "paused-wallet",
      shouldOpenEntry: false,
    });
  });
});
