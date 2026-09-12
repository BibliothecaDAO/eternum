import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context,
  type Model,
} from "@mariozechner/pi-ai";
import { OBSERVE_GAME_TOOL_NAME } from "./smoke-agent";

// The scripted model only ever finishes cleanly, which is what the `done` event's reason type requires.
type ScriptedMessage = AssistantMessage & { stopReason: "stop" | "toolUse" };

const FAKE_USAGE = {
  input: 100,
  output: 20,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 120,
  cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
};

// Scripted model: first call requests observe_game, every later call answers with text.
export const fakeStreamFn: StreamFn = (model, context) => {
  const stream = createAssistantMessageEventStream();
  const message = hasToolResult(context) ? finalAnswer(model) : observeGameCall(model);
  stream.push({ type: "start", partial: message });
  stream.push({ type: "done", reason: message.stopReason, message });
  return stream;
};

function hasToolResult(context: Context): boolean {
  return context.messages.some((message) => message.role === "toolResult");
}

function observeGameCall(model: Model<any>): ScriptedMessage {
  return assistantMessage(model, "toolUse", [
    { type: "toolCall", id: "call_1", name: OBSERVE_GAME_TOOL_NAME, arguments: {} },
  ]);
}

function finalAnswer(model: Model<any>): ScriptedMessage {
  return assistantMessage(model, "stop", [{ type: "text", text: "Pull Vanguard back to defend Ashfall." }]);
}

function assistantMessage(
  model: Model<any>,
  stopReason: ScriptedMessage["stopReason"],
  content: AssistantMessage["content"],
): ScriptedMessage {
  return {
    role: "assistant",
    content,
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: { ...FAKE_USAGE, cost: { ...FAKE_USAGE.cost } },
    stopReason,
    timestamp: Date.now(),
  };
}
