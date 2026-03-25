import { describe, expect, it, vi } from "vitest";

import { describeLatestAction, isHeartbeatStalled } from "./agent-dock-utils";

describe("describeLatestAction", () => {
  it("formats a failed tx action with the revert reason", () => {
    expect(
      describeLatestAction({
        toolName: "move_army",
        contractAddress: "0xmove",
        entrypoint: "explorer_move",
        calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
        txHash: "0xabc",
        receiptStatus: "REVERTED",
        status: "failed",
        errorMessage: "Not Owner",
        createdAt: "2026-03-25T10:00:05.000Z",
      }),
    ).toBe("move_army · explorer_move · Not Owner");
  });
});

describe("isHeartbeatStalled", () => {
  it("flags overdue idle heartbeats", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T10:05:00.000Z"));

    expect(
      isHeartbeatStalled({
        autonomyEnabled: true,
        executionState: "idle",
        nextWakeAt: "2026-03-25T10:03:00.000Z",
      }),
    ).toBe(true);

    vi.useRealTimers();
  });
});
