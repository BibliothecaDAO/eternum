import { beforeEach, describe, expect, it, vi } from "vitest";

const gate = vi.hoisted(() => ({ closed: true, told: [] as string[] }));
// The one act-now gate, as the clock gives it: shut before play opens (telling the player), open after.
vi.mock("@/utils/can-issue-orders", () => ({
  refusedBeforePlay: () => {
    if (gate.closed) gate.told.push("Starts in 4m 00s");
    return gate.closed;
  },
}));

import { usePopoverStore } from "./use-popover-store";

/** Production as the resource chip, the resource table and a building's double-click each open it. */
const openProductionFromAnEntrance = () =>
  usePopoverStore.getState().openSurface({ id: "production", content: null, anchor: "right-edge" });

beforeEach(() => {
  gate.closed = true;
  gate.told = [];
  usePopoverStore.getState().close();
});

describe("an order surface", () => {
  it("does not open before play opens, whichever entrance asks, and the player is told when it does", () => {
    openProductionFromAnEntrance();
    usePopoverStore.getState().openSurface({ id: "quick-attack", content: null });
    expect(usePopoverStore.getState().openId).toBeNull();
    expect(gate.told).toEqual(["Starts in 4m 00s", "Starts in 4m 00s"]);
  });

  it("opens once play opens", () => {
    gate.closed = false;
    openProductionFromAnEntrance();
    expect(usePopoverStore.getState().openId).toBe("production");
  });
});

it("leaves a surface that gives no order, the leaderboard, open before play opens", () => {
  usePopoverStore.getState().openSurface({ id: "leaderboard", content: null });
  expect(usePopoverStore.getState().openId).toBe("leaderboard");
  expect(gate.told).toEqual([]);
});
