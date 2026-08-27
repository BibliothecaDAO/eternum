import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginClientActionLatency,
  clearClientActionLatency,
  recordClientActionPreConfirmed,
  recordClientActionRendered,
  recordClientActionSubmitted,
  snapshotClientActionLatency,
  summarizeClientActionLatency,
} from "./client-action-latency";

describe("client action latency", () => {
  beforeEach(() => {
    clearClientActionLatency();
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce(50);
  });

  it("records the four client-observable action phases", () => {
    const actionId = beginClientActionLatency({ operation: "explore_reveal", surface: "worldmap" });
    recordClientActionSubmitted(actionId, "0x0abc");
    recordClientActionPreConfirmed("0xabc");
    recordClientActionRendered(actionId);

    expect(snapshotClientActionLatency()).toEqual([
      expect.objectContaining({
        actionId,
        operation: "explore_reveal",
        transactionHash: "0x0abc",
        phases: { click: 10, submitted: 20, pre_confirmed: 30, rendered: 50 },
      }),
    ]);
    expect(summarizeClientActionLatency("explore_reveal")).toMatchObject({
      completed: 1,
      p50ClickToRenderedMs: 40,
      p95ClickToRenderedMs: 40,
    });
  });
});
