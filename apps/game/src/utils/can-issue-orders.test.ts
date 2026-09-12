import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isSpectating: false, ended: false }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => state } }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { isGameOver: () => state.ended } }));
import { canIssueOrders } from "./can-issue-orders";
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
