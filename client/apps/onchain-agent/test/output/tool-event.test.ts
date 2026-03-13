import { describe, expect, it } from "vitest";
import { summarizeToolExecutionEnd } from "../../src/output/tool-event";

describe("summarizeToolExecutionEnd", () => {
  it("marks execute_action as fail when details.success is false", () => {
    const summary = summarizeToolExecutionEnd({
      type: "tool_execution_end",
      toolName: "execute_action",
      isError: false,
      result: { details: { success: false } },
    });

    expect(summary.status).toBe("fail");
    expect(summary.success).toBe(false);
  });

  it("extracts txHash and revert metadata from JSON content", () => {
    const summary = summarizeToolExecutionEnd({
      type: "tool_execution_end",
      toolName: "execute_action",
      isError: false,
      result: {
        details: { success: false },
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              txHash: "0x123",
              reasonCode: "REVERTED_ONCHAIN",
              error: "tile is already explored",
            }),
          },
        ],
      },
    });

    expect(summary.status).toBe("fail");
    expect(summary.txHash).toBe("0x123");
    expect(summary.reasonCode).toBe("REVERTED_ONCHAIN");
    expect(summary.error).toBe("tile is already explored");
  });
});
