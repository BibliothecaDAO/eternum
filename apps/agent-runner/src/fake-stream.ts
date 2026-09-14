import type { ID } from "@bibliothecadao/types";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context,
  type Model,
  type ToolCall,
} from "@mariozechner/pi-ai";

import type { SettledEmpire } from "./entry";
import type { RunnerGame } from "./game";
import { OBSERVE_GAME_TOOL_NAME } from "./smoke-agent";

// The scripted model only ever finishes cleanly, which is what the `done` event's reason type requires.
export type ScriptedMessage = AssistantMessage & { stopReason: "stop" | "toolUse" };

/** The one explorer the scripted model scouts with. */
export interface OfflineScout {
  explorerId: ID;
}

const LIST_ACTIONS_TOOL_NAME = "list_actions";
const ACT_TOOL_NAME = "act";
const ARMY_PATHS_KEY = `${ACT_TOOL_NAME}:armyPaths`;
const MOVE_ARMY_KEY = `${ACT_TOOL_NAME}:moveArmy`;
const HEX_PATTERN = /\((-?\d+),(-?\d+)\)/;

const FAKE_USAGE = {
  input: 100,
  output: 20,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 120,
  cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
};

/**
 * A deterministic model for `--offline`: it observes, and with a scout it learns the actions, plans the scout's
 * paths, and moves once to the first reachable hex. The tools decide the rest: with no signer the move is refused.
 * Each step happens once per conversation; afterwards every call answers with text.
 */
export const createOfflineStreamFn =
  (scout: OfflineScout | null): StreamFn =>
  (model, context) => {
    const message = nextScriptedMessage(model, context, scout);
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: message });
    stream.push({ type: "done", reason: message.stopReason, message });
    return stream;
  };

/**
 * My explorer if I have one; while spectating, the lowest-numbered explorer on the map, so a keyless run still
 * exercises the act path and its refusal.
 */
export const resolveOfflineScout = (game: RunnerGame, empire: SettledEmpire): OfflineScout | null => {
  const own = empire.explorers[0];
  if (own !== undefined) return { explorerId: own };
  const { ExplorerTroops } = game.client.setup.components;
  const explorerIds = [...runQuery([Has(ExplorerTroops)])]
    .map((entity) => getComponentValue(ExplorerTroops, entity)?.explorer_id)
    .filter((explorerId): explorerId is ID => explorerId !== undefined)
    .sort((left, right) => left - right);
  return explorerIds.length === 0 ? null : { explorerId: explorerIds[0]! };
};

const nextScriptedMessage = (model: Model<any>, context: Context, scout: OfflineScout | null): ScriptedMessage => {
  const done = toolCallsMade(context);
  const offered = new Set(context.tools?.map((tool) => tool.name));
  const callId = `call_${done.size + 1}`;
  if (!done.has(OBSERVE_GAME_TOOL_NAME)) return toolCall(model, callId, OBSERVE_GAME_TOOL_NAME, {});
  if (!scout) return finalAnswer(model);
  if (offered.has(LIST_ACTIONS_TOOL_NAME) && !done.has(LIST_ACTIONS_TOOL_NAME)) {
    return toolCall(model, callId, LIST_ACTIONS_TOOL_NAME, {});
  }
  if (offered.has(ACT_TOOL_NAME) && !done.has(ARMY_PATHS_KEY)) {
    return toolCall(model, callId, ACT_TOOL_NAME, { action: "armyPaths", params: { explorerId: scout.explorerId } });
  }
  const target = offered.has(ACT_TOOL_NAME) && !done.has(MOVE_ARMY_KEY) ? firstReachableHex(context) : null;
  if (target) {
    return toolCall(model, callId, ACT_TOOL_NAME, {
      action: "moveArmy",
      params: { explorerId: scout.explorerId, target },
    });
  }
  return finalAnswer(model);
};

/** Tool names already called in this conversation; act calls are keyed by their action so each step happens once. */
const toolCallsMade = (context: Context): Set<string> => {
  const made = new Set<string>();
  for (const message of context.messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type === "toolCall") made.add(toolCallKey(part));
    }
  }
  return made;
};

const toolCallKey = (call: ToolCall): string =>
  call.name === ACT_TOOL_NAME
    ? `${ACT_TOOL_NAME}:${String((call.arguments as { action?: unknown }).action)}`
    : call.name;

/** The first hex the armyPaths result names, read the way a model would: from the tool's text. */
const firstReachableHex = (context: Context): { col: number; row: number } | null => {
  for (const message of context.messages) {
    if (message.role !== "toolResult" || message.toolName !== ACT_TOOL_NAME) continue;
    const text = message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
    if (!text.startsWith("armyPaths:")) continue;
    const hex = HEX_PATTERN.exec(text);
    return hex ? { col: Number(hex[1]), row: Number(hex[2]) } : null;
  }
  return null;
};

const toolCall = (model: Model<any>, id: string, name: string, args: Record<string, unknown>): ScriptedMessage =>
  scriptedAssistantMessage(model, "toolUse", [{ type: "toolCall", id, name, arguments: args }]);

const finalAnswer = (model: Model<any>): ScriptedMessage =>
  scriptedAssistantMessage(model, "stop", [{ type: "text", text: "Pull Vanguard back to defend Ashfall." }]);

export function scriptedAssistantMessage(
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
