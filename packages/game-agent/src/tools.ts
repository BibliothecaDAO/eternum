import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ActionDefinition, GameAdapter, RuntimeConfigManager } from "./types.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

/** Log tool responses to a debug file so we can see what the agent sees. */
function logToolResponse(toolName: string, params: any, response: string) {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug-tool-responses.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const paramStr = params ? JSON.stringify(params) : "";
    writeFileSync(debugPath, `\n[${ts}] ${toolName}(${paramStr})\n${response}\n`, { flag: "a" });
  } catch (_) {}
}

const observeSchema = Type.Object({
  filter: Type.Optional(Type.String({ description: "Optional filter for entities" })),
});

/**
 * Creates a tool that observes the current game world state.
 * The tool calls adapter.getWorldState() and returns the state as JSON.
 * Map values (like resources) are serialized to plain objects.
 *
 * Note: The tick prompt already provides formatted world state each tick,
 * but this tool is available for on-demand queries between ticks.
 */
export function createObserveGameTool(adapter: GameAdapter<any>): AgentTool<typeof observeSchema> {
  return {
    name: "observe_game",
    label: "Observe Game",
    description: "Get the current game world state including entities, resources, and tick information. Use this to refresh your view of the world between ticks.",
    parameters: observeSchema,
    async execute(_toolCallId, _params) {
      const state = await adapter.getWorldState();
      const serializable = {
        ...state,
        resources: state.resources ? Object.fromEntries(state.resources) : undefined,
      };
      const response = JSON.stringify(serializable, null, 2);
      logToolResponse("observe_game", _params, response);
      return {
        content: [{ type: "text", text: response }],
        details: { tick: state.tick },
      };
    },
  };
}

/**
 * Build a human-readable description block from action definitions.
 * Used by the list_actions tool to return the full catalog on demand.
 */
function formatActionDocs(actions: ActionDefinition[]): string {
  if (actions.length === 0) return "No actions registered.";

  const lines: string[] = [];
  for (const action of actions) {
    lines.push(`- ${action.type}: ${action.description}`);
    for (const p of action.params) {
      const req = p.required === false ? " (optional)" : "";
      lines.push(`    - ${p.name} (${p.type}${req}): ${p.description}`);
    }
  }
  return lines.join("\n");
}

/**
 * Creates a tool that returns the action catalog on demand.
 * The LLM calls this when it needs to look up available actions and their parameters.
 */
export function createListActionsTool(actionDefs: ActionDefinition[]): AgentTool<any> {
  const cached = formatActionDocs(actionDefs);

  return {
    name: "list_actions",
    label: "List Actions",
    description:
      "Look up available game actions and their parameters. " +
      "Call this before execute_action or simulate_action to find valid action types and required params.",
    parameters: Type.Object({
      filter: Type.Optional(
        Type.String({ description: "Optional keyword to filter actions (e.g. 'trade', 'troop', 'build')" }),
      ),
    }),
    async execute(_toolCallId, { filter }: { filter?: string }) {
      if (actionDefs.length === 0) {
        return { content: [{ type: "text", text: "No actions registered." }], details: { total: 0, filtered: false } };
      }
      let text = cached;
      if (filter) {
        const lower = filter.toLowerCase();
        const filtered = actionDefs.filter(
          (a) => a.type.toLowerCase().includes(lower) || a.description.toLowerCase().includes(lower),
        );
        text = filtered.length > 0 ? formatActionDocs(filtered) : `No actions matching "${filter}".`;
      }
      logToolResponse("list_actions", { filter }, text);
      return {
        content: [{ type: "text", text }],
        details: { total: actionDefs.length, filtered: !!filter },
      };
    },
  };
}

/**
 * Creates a tool that executes a game action on chain via the adapter.
 * When actionDefs are provided, actionType is constrained to a StringEnum of valid types.
 * Use list_actions to look up available actions and their parameters.
 */
export function createExecuteActionTool(adapter: GameAdapter<any>, actionDefs?: ActionDefinition[]): AgentTool<any> {
  const actionTypes = actionDefs?.map((a) => a.type) ?? [];
  const actionSchema = Type.Object({
    actionType:
      actionTypes.length > 0
        ? StringEnum(actionTypes, { description: "The action type to execute" })
        : Type.String({ description: "The type of action to execute (e.g. 'move', 'attack', 'build')" }),
    params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Parameters for the action" })),
  });

  return {
    name: "execute_action",
    label: "Execute Action",
    description:
      "Execute a game action on chain. Returns success status and transaction hash. " +
      "Use list_actions first to look up valid action types and their required params.",
    parameters: actionSchema,
    async execute(_toolCallId, { actionType, params }: { actionType: string; params?: Record<string, unknown> }) {
      const result = await adapter.executeAction({
        type: actionType,
        params: params ?? {},
      });
      const text = JSON.stringify(result, null, 2);
      logToolResponse("execute_action", { actionType, params }, text);
      return {
        content: [{ type: "text", text }],
        details: { actionType, success: result.success },
      };
    },
  };
}

/**
 * Creates a tool that simulates a game action (dry run) without executing on chain.
 * When actionDefs are provided, actionType is constrained to a StringEnum of valid types.
 * Use list_actions to look up available actions and their parameters.
 */
export function createSimulateActionTool(adapter: GameAdapter<any>, actionDefs?: ActionDefinition[]): AgentTool<any> {
  const actionTypes = actionDefs?.map((a) => a.type) ?? [];
  const simulateSchema = Type.Object({
    actionType:
      actionTypes.length > 0
        ? StringEnum(actionTypes, { description: "The action type to simulate" })
        : Type.String({ description: "The type of action to simulate (e.g. 'move', 'attack', 'build')" }),
    params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Parameters for the action" })),
  });

  return {
    name: "simulate_action",
    label: "Simulate Action",
    description:
      "Simulate a game action without executing it. Returns predicted outcome and cost estimates. " +
      "Use list_actions first to look up valid action types and their required params.",
    parameters: simulateSchema,
    async execute(_toolCallId, { actionType, params }: { actionType: string; params?: Record<string, unknown> }) {
      const result = await adapter.simulateAction({
        type: actionType,
        params: params ?? {},
      });
      const text = JSON.stringify(result, null, 2);
      logToolResponse("simulate_action", { actionType, params }, text);
      return {
        content: [{ type: "text", text }],
        details: { actionType, success: result.success },
      };
    },
  };
}

/**
 * Creates all game-related tools for the given adapter.
 * When actionDefs are provided, execute_action and simulate_action get constrained
 * actionType enums, and a list_actions lookup tool is included.
 */
export function createGameTools(adapter: GameAdapter<any>, actionDefs?: ActionDefinition[]): AgentTool<any>[] {
  const tools: AgentTool<any>[] = [
    createObserveGameTool(adapter),
    createExecuteActionTool(adapter, actionDefs),
    createSimulateActionTool(adapter, actionDefs),
  ];
  if (actionDefs && actionDefs.length > 0) {
    tools.push(createListActionsTool(actionDefs));
  }
  return tools;
}

const setAgentConfigSchema = Type.Object({
  changes: Type.Array(
    Type.Object({
      path: Type.String({ description: "Dot-path key to update (example: tickIntervalMs or world.rpcUrl)" }),
      value: Type.Unknown({ description: "New value to set for the path" }),
    }),
    { minItems: 1 },
  ),
  reason: Type.Optional(Type.String({ description: "Optional short reason for this configuration change" })),
});

export function createGetAgentConfigTool(runtimeConfigManager: RuntimeConfigManager): AgentTool<any> {
  return {
    name: "get_agent_config",
    label: "Get Agent Config",
    description: "Read the agent's live runtime configuration.",
    parameters: Type.Object({}),
    async execute() {
      const config = runtimeConfigManager.getConfig();
      return {
        content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
        details: { keys: Object.keys(config).length },
      };
    },
  };
}

export function createSetAgentConfigTool(runtimeConfigManager: RuntimeConfigManager): AgentTool<any> {
  return {
    name: "set_agent_config",
    label: "Set Agent Config",
    description:
      "Apply one or more live configuration changes to the running agent. This can update tick rate, model, and world connectivity config.",
    parameters: setAgentConfigSchema,
    async execute(_toolCallId, { changes, reason }) {
      const result = await runtimeConfigManager.applyChanges(changes, reason);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        details: { ok: result.ok, changed: result.results.filter((r) => r.applied).length },
      };
    },
  };
}

export function createAgentConfigTools(runtimeConfigManager: RuntimeConfigManager): AgentTool<any>[] {
  return [createGetAgentConfigTool(runtimeConfigManager), createSetAgentConfigTool(runtimeConfigManager)];
}
