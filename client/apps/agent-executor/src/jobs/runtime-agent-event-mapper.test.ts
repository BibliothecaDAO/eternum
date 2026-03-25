import { describe, expect, it } from "vitest";

import { mapRuntimeEventToAgentEvent } from "./runtime-agent-event-mapper";

describe("mapRuntimeEventToAgentEvent", () => {
  it("maps runtime tx submission events into durable agent activity", () => {
    const event = mapRuntimeEventToAgentEvent("agent-1", {
      type: "managed_runtime.transaction_submitted",
      payload: {
        toolName: "move_army",
        runtimeToolCallId: "tool-1",
        contractAddress: "0xmove",
        entrypoint: "explorer_move",
        calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
        txHash: "0xabc",
      },
    });

    expect(event.type).toBe("agent.action_submitted");
    expect(event.payload).toMatchObject({
      toolName: "move_army",
      runtimeToolCallId: "tool-1",
      contractAddress: "0xmove",
      entrypoint: "explorer_move",
      txHash: "0xabc",
    });
  });

  it("maps runtime tx failures into final action events", () => {
    const event = mapRuntimeEventToAgentEvent("agent-1", {
      type: "managed_runtime.transaction_confirmed",
      payload: {
        toolName: "move_army",
        contractAddress: "0xmove",
        entrypoint: "explorer_move",
        txHash: "0xabc",
        receiptStatus: "REVERTED",
        isError: true,
        errorMessage: "Not Owner",
      },
    });

    expect(event.type).toBe("agent.action_confirmed");
    expect(event.payload).toMatchObject({
      txHash: "0xabc",
      receiptStatus: "REVERTED",
      isError: true,
      errorMessage: "Not Owner",
    });
  });
});
