import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { GameAdapter, RuntimeConfigManager } from "./types.js";

const observeSchema = Type.Object({
	filter: Type.Optional(Type.String({ description: "Optional filter for entities" })),
});

/**
 * Creates a tool that observes the current game world state.
 * The tool calls adapter.getWorldState() and returns the state as JSON.
 * Map values (like resources) are serialized to plain objects.
 */
export function createObserveGameTool(adapter: GameAdapter<any>): AgentTool<typeof observeSchema> {
	return {
		name: "observe_game",
		label: "Observe Game",
		description: "Get the current game world state including entities, resources, and tick information.",
		parameters: observeSchema,
		async execute(_toolCallId, _params) {
			const state = await adapter.getWorldState();
			// Handle Map serialization for resources
			const serializable = {
				...state,
				resources: state.resources ? Object.fromEntries(state.resources) : undefined,
			};
			return {
				content: [{ type: "text", text: JSON.stringify(serializable, null, 2) }],
				details: { tick: state.tick },
			};
		},
	};
}

const actionSchema = Type.Object({
	actionType: Type.String({ description: "The type of action to execute (e.g. 'move', 'attack', 'build')" }),
	params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Parameters for the action" })),
});

/**
 * Creates a tool that executes a game action on chain via the adapter.
 * Returns the action result including success status and optional txHash.
 */
export function createExecuteActionTool(adapter: GameAdapter<any>): AgentTool<typeof actionSchema> {
	return {
		name: "execute_action",
		label: "Execute Action",
		description: "Execute a game action on chain. Returns success status and transaction hash.",
		parameters: actionSchema,
		async execute(_toolCallId, { actionType, params }) {
			const result = await adapter.executeAction({
				type: actionType,
				params: params ?? {},
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: { actionType, success: result.success },
			};
		},
	};
}

const simulateSchema = Type.Object({
	actionType: Type.String({ description: "The type of action to simulate (e.g. 'move', 'attack', 'build')" }),
	params: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Parameters for the action" })),
});

/**
 * Creates a tool that simulates a game action (dry run) without executing on chain.
 * Returns predicted outcome and cost estimates.
 */
export function createSimulateActionTool(adapter: GameAdapter<any>): AgentTool<typeof simulateSchema> {
	return {
		name: "simulate_action",
		label: "Simulate Action",
		description: "Simulate a game action without executing it. Returns predicted outcome and cost estimates.",
		parameters: simulateSchema,
		async execute(_toolCallId, { actionType, params }) {
			const result = await adapter.simulateAction({
				type: actionType,
				params: params ?? {},
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: { actionType, success: result.success },
			};
		},
	};
}

/**
 * Creates all game-related tools for the given adapter.
 * Returns [observe_game, execute_action, simulate_action].
 */
export function createGameTools(adapter: GameAdapter<any>): AgentTool<any>[] {
	return [createObserveGameTool(adapter), createExecuteActionTool(adapter), createSimulateActionTool(adapter)];
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
