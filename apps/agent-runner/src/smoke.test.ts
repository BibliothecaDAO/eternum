import { getModel } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { fakeStreamFn } from "./fake-stream";
import { buildAgent, OBSERVE_GAME_TOOL_NAME, runSmoke, WORLD_STATE_UPDATE_PREFIX } from "./smoke-agent";

describe("agent runner smoke (offline)", () => {
  it("runs the tool, injects the steer message mid-run, and aggregates usage", async () => {
    const agent = buildAgent(getModel("openrouter", "openai/gpt-4o-mini"), fakeStreamFn);

    const report = await runSmoke(agent);

    expect(report.turns).toBe(2);
    expect(report.toolCalls).toBe(1);
    expect(report.steered).toBe(true);
    expect(report.eventTypes).toEqual(
      expect.arrayContaining(["agent_start", "tool_execution_start", "tool_execution_end", "agent_end"]),
    );
    expect(report.eventTypes.at(-1)).toBe("agent_end");

    expect(roleSequence(report.messages)).toEqual(["user", "assistant", "toolResult", "user", "assistant"]);
    const toolResult = report.messages[2];
    expect(toolResult.role === "toolResult" && toolResult.toolName).toBe(OBSERVE_GAME_TOOL_NAME);
    const steerMessage = report.messages[3];
    expect(steerMessage.role === "user" && steerMessage.content).toContain(WORLD_STATE_UPDATE_PREFIX);

    expect(report.usage).toEqual({ input: 200, output: 40, cost: 0.006 });
  });
});

function roleSequence(messages: { role: string }[]): string[] {
  return messages.map((message) => message.role);
}
