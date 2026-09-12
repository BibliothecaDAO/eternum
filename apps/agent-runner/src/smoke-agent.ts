import { Agent, type AgentEvent, type AgentMessage, type AgentTool, type StreamFn } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { Type } from "typebox";

export const OBSERVE_GAME_TOOL_NAME = "observe_game";
export const WORLD_STATE_UPDATE_PREFIX = "[WORLD STATE UPDATE]";

const SYSTEM_PROMPT = [
  "You are a hired agent playing Eternum, an onchain strategy game.",
  `Call ${OBSERVE_GAME_TOOL_NAME} before deciding anything, then answer in one short sentence.`,
].join(" ");

const SMOKE_PROMPT = "Observe the game and tell me the single most urgent thing to do next.";

const FAKE_WORLD_SUMMARY = [
  "Realm 'Ashfall' at (12, -4): 3 buildings, 1,200 wheat, 340 wood, 0 stone.",
  "Army 'Vanguard' at (13, -4): 40 knights, 80% stamina, idle.",
  "Nearby: unexplored tile at (14, -5); hostile army 2 tiles east.",
].join("\n");

const STEER_MESSAGE = `${WORLD_STATE_UPDATE_PREFIX} Hostile army moved adjacent to Ashfall.`;

export interface SmokeUsage {
  input: number;
  output: number;
  cost: number;
}

export interface SmokeReport {
  turns: number;
  toolCalls: number;
  steered: boolean;
  eventTypes: AgentEvent["type"][];
  messages: AgentMessage[];
  usage: SmokeUsage;
}

export function buildAgent(model: Model<any>, streamFn?: StreamFn): Agent {
  return new Agent({
    initialState: { systemPrompt: SYSTEM_PROMPT, model, tools: [observeGameTool] },
    streamFn,
  });
}

export async function runSmoke(agent: Agent): Promise<SmokeReport> {
  const eventTypes: AgentEvent["type"][] = [];
  let steered = false;

  agent.subscribe((event) => {
    eventTypes.push(event.type);
    if (!steered && isAssistantMessageEnd(event)) {
      steered = true;
      agent.steer(worldStateUpdate());
    }
  });

  await agent.prompt(SMOKE_PROMPT);

  const messages = agent.state.messages;
  return {
    turns: eventTypes.filter((type) => type === "turn_end").length,
    toolCalls: eventTypes.filter((type) => type === "tool_execution_end").length,
    steered,
    eventTypes,
    messages,
    usage: aggregateUsage(messages),
  };
}

const observeGameTool: AgentTool = {
  name: OBSERVE_GAME_TOOL_NAME,
  label: "Observe game",
  description: "Returns a summary of the agent's realms, armies, and nearby threats.",
  parameters: Type.Object({
    focus: Type.Optional(Type.String({ description: "Optional area to focus the summary on." })),
  }),
  execute: async () => ({ content: [{ type: "text", text: FAKE_WORLD_SUMMARY }], details: undefined }),
};

// Steering right after the first assistant message lands guarantees the run is still in flight:
// the queue is polled only after this turn's tool calls finish, so the message reaches the next LLM call.
function isAssistantMessageEnd(event: AgentEvent): boolean {
  return event.type === "message_end" && event.message.role === "assistant";
}

function worldStateUpdate(): AgentMessage {
  return { role: "user", content: STEER_MESSAGE, timestamp: Date.now() };
}

function aggregateUsage(messages: AgentMessage[]): SmokeUsage {
  const usage = { input: 0, output: 0, cost: 0 };
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    usage.input += message.usage.input;
    usage.output += message.usage.output;
    usage.cost += message.usage.cost.total;
  }
  return usage;
}
