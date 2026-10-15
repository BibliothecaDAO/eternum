import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isSpectating: false, ended: false, now: 0 }));
const SEASON = { startSettlingAt: 400, startMainAt: 1_000, endAt: 5_000 };
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => state } }));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    isGameOver: () => state.ended,
    getSeasonConfig: () => SEASON,
    getDevModeConfig: () => ({ dev_mode_on: false }),
  },
  getBlockTimestamp: () => ({ currentBlockTimestamp: state.now }),
}));
import { ActionRefusedError, createSystemCalls } from "@bibliothecadao/types";
import { actNowRefusal, canIssueOrders, refusalBefore } from "./can-issue-orders";
import { overrideSpectateIntent } from "./spectator-session";

beforeEach(() => {
  state.isSpectating = false;
  state.ended = false;
  overrideSpectateIntent(false);
});

describe("canIssueOrders", () => {
  it.each([
    [false, false, true],
    [true, false, false],
    [false, true, false],
    [true, true, false],
  ])("gates HUD spectator=%s and explicit spectator=%s", (hud, explicit, expected) => {
    state.isSpectating = hud;
    overrideSpectateIntent(explicit);
    expect(canIssueOrders()).toBe(expected);
    expect(canIssueOrders(state)).toBe(expected);
  });
});

it("retains spectator intent through scene-owned state resets", () => {
  overrideSpectateIntent(true);
  state.isSpectating = true;
  expect(canIssueOrders()).toBe(false);
  state.isSpectating = false;
  expect(canIssueOrders()).toBe(false);
});

it("disables orders for a finished game even when the player owns the selection", () => {
  state.ended = true;
  expect(canIssueOrders()).toBe(false);
});

describe("acting now", () => {
  it("is refused until play opens, saying how long until it does", () => {
    expect(refusalBefore(1_000, 760)).toBe("Starts in 4m 00s");
    expect(refusalBefore(1_000, 999)).toBe("Starts in 0m 01s");
  });

  it("is open from the moment play opens", () => {
    expect(refusalBefore(1_000, 1_000)).toBeNull();
    expect(refusalBefore(0, 5)).toBeNull();
  });
});

describe("a production order, from whichever entrance", () => {
  const provider = { burn_resource_for_resource_production: vi.fn().mockResolvedValue({ transaction_hash: "0xa" }) };
  // The game client's own wiring (init/bootstrap.tsx): every system call asks the act-now gate first.
  const calls = createSystemCalls({ provider, authHandler: { refuseNow: () => actNowRefusal() } });
  const order = () => calls.burn_resource_for_resource_production({ signer: { address: "0x1" } } as never);

  it("never leaves the client before play opens, saying when it does, then is sent once it has", async () => {
    state.now = 760;
    await expect(order()).rejects.toEqual(new ActionRefusedError("Starts in 4m 00s"));
    expect(provider.burn_resource_for_resource_production).not.toHaveBeenCalled();

    state.now = 1_000;
    await expect(order()).resolves.toEqual({ transaction_hash: "0xa" });
    expect(provider.burn_resource_for_resource_production).toHaveBeenCalledTimes(1);
  });
});
