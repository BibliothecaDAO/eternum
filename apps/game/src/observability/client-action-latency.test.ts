import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginClientActionLatency,
  clearClientActionLatency,
  recordClientActionPreConfirmed,
  recordClientActionDiffReceived,
  recordClientActionPhase,
  recordClientActionStoreApplied,
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
      .mockReturnValueOnce(40)
      .mockReturnValueOnce(45)
      .mockReturnValueOnce(50)
      .mockReturnValueOnce(60);
  });

  it("records submit, stream, native store, and rendered action phases", () => {
    const actionId = beginClientActionLatency({ operation: "explore_reveal", surface: "worldmap" });
    recordClientActionPhase(actionId, "calls_built");
    recordClientActionSubmitted(actionId, "0x0abc");
    recordClientActionPreConfirmed("0xabc");
    recordClientActionDiffReceived("0xabc");
    recordClientActionStoreApplied("0xabc");
    recordClientActionRendered(actionId);

    expect(snapshotClientActionLatency()).toEqual([
      expect.objectContaining({
        actionId,
        operation: "explore_reveal",
        transactionHash: "0x0abc",
        phases: {
          click: 10,
          calls_built: 20,
          submitted: 30,
          pre_confirmed: 40,
          diff_received: 45,
          store_applied: 50,
          rendered: 60,
        },
      }),
    ]);
    expect(summarizeClientActionLatency("explore_reveal")).toMatchObject({
      completed: 1,
      p50ClickToRenderedMs: 50,
      p95ClickToRenderedMs: 50,
      p50PreConfirmedToRenderedMs: 20,
      p95PreConfirmedToRenderedMs: 20,
    });
  });
});
