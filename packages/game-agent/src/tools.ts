import type { AgentTool } from "@mariozechner/pi-agent-core";
import { StringEnum } from "@mariozechner/pi-ai";
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

// -- All valid action type names (from action-registry.ts) --
const ACTION_TYPES = [
	// Resources
	"send_resources", "pickup_resources", "claim_arrivals",
	// Troops
	"create_explorer", "add_to_explorer", "delete_explorer",
	"add_guard", "delete_guard",
	// Movement
	"move_explorer", "travel_explorer", "explore",
	// Troop swaps
	"swap_explorer_to_explorer", "swap_explorer_to_guard", "swap_guard_to_explorer",
	// Combat
	"attack_explorer", "attack_guard", "guard_attack_explorer", "raid",
	// Trade
	"create_order", "accept_order", "cancel_order",
	// Buildings
	"create_building", "destroy_building", "pause_production", "resume_production",
	// Bank
	"buy_resources", "sell_resources", "add_liquidity", "remove_liquidity",
	// Guild
	"create_guild", "join_guild", "leave_guild", "update_whitelist",
	// Realm & Hyperstructure
	"upgrade_realm", "contribute_hyperstructure",
] as const;

const actionSchema = Type.Object({
	actionType: StringEnum(ACTION_TYPES, {
		description: "The action to execute. See param descriptions for which params each action requires.",
	}),

	// ---- Resource params ----
	senderEntityId: Type.Optional(Type.Number({
		description: "send_resources: entity ID of the sender structure",
	})),
	recipientEntityId: Type.Optional(Type.Number({
		description: "send_resources, pickup_resources: entity ID of the recipient structure",
	})),
	ownerEntityId: Type.Optional(Type.Number({
		description: "pickup_resources: entity ID of the owner to pick up from",
	})),
	resources: Type.Optional(Type.Array(
		Type.Object({
			resourceType: Type.Number({ description: "Resource type ID" }),
			amount: Type.Number({ description: "Amount of the resource" }),
		}),
		{ description: "send_resources, pickup_resources: array of resources to transfer" },
	)),
	day: Type.Optional(Type.Number({
		description: "claim_arrivals: the day to claim",
	})),
	resourceCount: Type.Optional(Type.Number({
		description: "claim_arrivals: number of resource types arriving",
	})),

	// ---- Structure / entity IDs ----
	forStructureId: Type.Optional(Type.Number({
		description: "create_explorer, add_guard, delete_guard: structure entity ID to act on",
	})),
	entityId: Type.Optional(Type.Number({
		description: "create_building, destroy_building, pause_production, resume_production, buy_resources, sell_resources, add_liquidity, remove_liquidity: entity ID of the structure",
	})),
	structureId: Type.Optional(Type.Number({
		description: "claim_arrivals, attack_guard, guard_attack_explorer, raid: structure entity ID",
	})),

	// ---- Troop params ----
	category: Type.Optional(Type.Number({
		description: "create_explorer, add_guard: troop category (0=Paladin, 1=Knight, 2=Crossbowman)",
	})),
	tier: Type.Optional(Type.Number({
		description: "create_explorer, add_guard: troop tier (1, 2, or 3)",
	})),
	amount: Type.Optional(Type.Number({
		description: "create_explorer, add_guard, add_to_explorer, buy_resources, sell_resources: quantity/amount",
	})),
	slot: Type.Optional(Type.Number({
		description: "claim_arrivals, add_guard, delete_guard: guard slot number",
	})),
	spawnDirection: Type.Optional(Type.Number({
		description: "create_explorer: hex direction to spawn (0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE)",
	})),

	// ---- Explorer params ----
	explorerId: Type.Optional(Type.Number({
		description: "delete_explorer, move_explorer, travel_explorer, explore, attack_guard, guard_attack_explorer, raid: explorer entity ID",
	})),
	toExplorerId: Type.Optional(Type.Number({
		description: "add_to_explorer, swap_explorer_to_explorer, swap_guard_to_explorer: target explorer entity ID",
	})),
	homeDirection: Type.Optional(Type.Number({
		description: "add_to_explorer: hex direction toward home structure (0-5)",
	})),
	directions: Type.Optional(Type.Array(Type.Number(), {
		description: "move_explorer, travel_explorer, explore, create_building: array of hex directions (0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE)",
	})),
	explore: Type.Optional(Type.Boolean({
		description: "move_explorer: whether to explore tiles along the path (true/false)",
	})),

	// ---- Swap params ----
	fromExplorerId: Type.Optional(Type.Number({
		description: "swap_explorer_to_explorer, swap_explorer_to_guard: source explorer entity ID",
	})),
	toExplorerDirection: Type.Optional(Type.Number({
		description: "swap_explorer_to_explorer, swap_guard_to_explorer: hex direction to target explorer (0-5)",
	})),
	count: Type.Optional(Type.Number({
		description: "swap_explorer_to_explorer, swap_explorer_to_guard, swap_guard_to_explorer: number of troops to swap",
	})),
	toStructureId: Type.Optional(Type.Number({
		description: "swap_explorer_to_guard: target structure entity ID",
	})),
	toStructureDirection: Type.Optional(Type.Number({
		description: "swap_explorer_to_guard: hex direction to target structure (0-5)",
	})),
	toGuardSlot: Type.Optional(Type.Number({
		description: "swap_explorer_to_guard: target guard slot number",
	})),
	fromStructureId: Type.Optional(Type.Number({
		description: "swap_guard_to_explorer: source structure entity ID",
	})),
	fromGuardSlot: Type.Optional(Type.Number({
		description: "swap_guard_to_explorer: source guard slot number",
	})),

	// ---- Combat params ----
	aggressorId: Type.Optional(Type.Number({
		description: "attack_explorer: attacker explorer entity ID",
	})),
	defenderId: Type.Optional(Type.Number({
		description: "attack_explorer: defender explorer entity ID",
	})),
	defenderDirection: Type.Optional(Type.Number({
		description: "attack_explorer: hex direction to defender (0-5)",
	})),
	stealResources: Type.Optional(Type.Array(
		Type.Object({
			resourceId: Type.Number({ description: "Resource type ID to steal" }),
			amount: Type.Number({ description: "Amount to steal" }),
		}),
		{ description: "attack_explorer, raid: resources to steal from the target" },
	)),
	structureDirection: Type.Optional(Type.Number({
		description: "attack_guard, raid: hex direction to target structure (0-5)",
	})),
	structureGuardSlot: Type.Optional(Type.Number({
		description: "guard_attack_explorer: guard slot number to use for attack",
	})),
	explorerDirection: Type.Optional(Type.Number({
		description: "guard_attack_explorer: hex direction to target explorer (0-5)",
	})),

	// ---- Trade params ----
	makerId: Type.Optional(Type.Number({
		description: "create_order: maker entity ID",
	})),
	takerId: Type.Optional(Type.Number({
		description: "create_order, accept_order: taker entity ID",
	})),
	makerGivesResourceType: Type.Optional(Type.Number({
		description: "create_order: resource type the maker gives",
	})),
	takerPaysResourceType: Type.Optional(Type.Number({
		description: "create_order: resource type the taker pays",
	})),
	makerGivesMinResourceAmount: Type.Optional(Type.Number({
		description: "create_order: minimum resource amount per unit the maker gives",
	})),
	makerGivesMaxCount: Type.Optional(Type.Number({
		description: "create_order: maximum number of units the maker will sell",
	})),
	takerPaysMinResourceAmount: Type.Optional(Type.Number({
		description: "create_order: minimum resource amount per unit the taker pays",
	})),
	expiresAt: Type.Optional(Type.Number({
		description: "create_order: expiration timestamp",
	})),
	tradeId: Type.Optional(Type.Number({
		description: "accept_order, cancel_order: trade order ID",
	})),
	takerBuysCount: Type.Optional(Type.Number({
		description: "accept_order: number of units to buy",
	})),

	// ---- Building params ----
	buildingCategory: Type.Optional(Type.Number({
		description: "create_building: 0=None, 1=Castle, 2=Resource, 3=Farm, 4=FishingVillage, 5=Barracks, 6=Market, 7=ArcheryRange, 8=Stable, 9=TradingPost, 10=WorkersHut, 11=WatchTower, 12=Walls, 13=Storehouse",
	})),
	useSimple: Type.Optional(Type.Boolean({
		description: "create_building: use simple building placement (true/false)",
	})),
	buildingCoord: Type.Optional(Type.Object({
		x: Type.Number({ description: "Building x coordinate" }),
		y: Type.Number({ description: "Building y coordinate" }),
	}, {
		description: "destroy_building, pause_production, resume_production: coordinates of the building",
	})),

	// ---- Bank params ----
	bankEntityId: Type.Optional(Type.Number({
		description: "buy_resources, sell_resources, add_liquidity, remove_liquidity: bank entity ID",
	})),
	resourceType: Type.Optional(Type.Number({
		description: "buy_resources, sell_resources, remove_liquidity: resource type ID",
	})),
	shares: Type.Optional(Type.Number({
		description: "remove_liquidity: number of LP shares to remove",
	})),
	calls: Type.Optional(Type.Array(
		Type.Object({
			resourceType: Type.Number({ description: "Resource type ID" }),
			resourceAmount: Type.Number({ description: "Resource amount" }),
			lordsAmount: Type.Number({ description: "Lords amount to pair" }),
		}),
		{ description: "add_liquidity: array of liquidity provision calls" },
	)),

	// ---- Guild params ----
	isPublic: Type.Optional(Type.Boolean({
		description: "create_guild: whether the guild is public (true/false)",
	})),
	guildName: Type.Optional(Type.String({
		description: "create_guild: name for the new guild",
	})),
	guildEntityId: Type.Optional(Type.Number({
		description: "join_guild: entity ID of the guild to join",
	})),
	address: Type.Optional(Type.String({
		description: "update_whitelist: player address to whitelist/blacklist",
	})),
	whitelist: Type.Optional(Type.Boolean({
		description: "update_whitelist: true to whitelist, false to remove",
	})),

	// ---- Realm params ----
	realmEntityId: Type.Optional(Type.Number({
		description: "upgrade_realm: entity ID of the realm to upgrade",
	})),

	// ---- Hyperstructure params ----
	hyperstructureEntityId: Type.Optional(Type.Number({
		description: "contribute_hyperstructure: entity ID of the hyperstructure",
	})),
	contributorEntityId: Type.Optional(Type.Number({
		description: "contribute_hyperstructure: entity ID of the contributing structure",
	})),
	contributions: Type.Optional(Type.Array(Type.Number(), {
		description: "contribute_hyperstructure: array of contribution amounts",
	})),
});

const EXECUTE_ACTION_DESCRIPTION = `Execute a game action on chain. Returns success status and transaction hash.

## Required Params Per Action

### Resources
- send_resources: senderEntityId, recipientEntityId, resources[]
- pickup_resources: recipientEntityId, ownerEntityId, resources[]
- claim_arrivals: structureId, day, slot, resourceCount

### Troops
- create_explorer: forStructureId, category, tier, amount, spawnDirection
- add_to_explorer: toExplorerId, amount, homeDirection
- delete_explorer: explorerId
- add_guard: forStructureId, slot, category, tier, amount
- delete_guard: forStructureId, slot

### Movement
- move_explorer: explorerId, directions[], explore
- travel_explorer: explorerId, directions[]
- explore: explorerId, directions[]

### Troop Swaps
- swap_explorer_to_explorer: fromExplorerId, toExplorerId, toExplorerDirection, count
- swap_explorer_to_guard: fromExplorerId, toStructureId, toStructureDirection, toGuardSlot, count
- swap_guard_to_explorer: fromStructureId, fromGuardSlot, toExplorerId, toExplorerDirection, count

### Combat
- attack_explorer: aggressorId, defenderId, defenderDirection, stealResources[]
- attack_guard: explorerId, structureId, structureDirection
- guard_attack_explorer: structureId, structureGuardSlot, explorerId, explorerDirection
- raid: explorerId, structureId, structureDirection, stealResources[]

### Trade
- create_order: makerId, takerId, makerGivesResourceType, takerPaysResourceType, makerGivesMinResourceAmount, makerGivesMaxCount, takerPaysMinResourceAmount, expiresAt
- accept_order: takerId, tradeId, takerBuysCount
- cancel_order: tradeId

### Buildings
- create_building: entityId, directions[], buildingCategory, useSimple
- destroy_building: entityId, buildingCoord{x,y}
- pause_production: entityId, buildingCoord{x,y}
- resume_production: entityId, buildingCoord{x,y}

### Bank
- buy_resources: bankEntityId, entityId, resourceType, amount
- sell_resources: bankEntityId, entityId, resourceType, amount
- add_liquidity: bankEntityId, entityId, calls[]
- remove_liquidity: bankEntityId, entityId, resourceType, shares

### Guild
- create_guild: isPublic, guildName
- join_guild: guildEntityId
- leave_guild: (no params)
- update_whitelist: address, whitelist

### Realm & Hyperstructure
- upgrade_realm: realmEntityId
- contribute_hyperstructure: hyperstructureEntityId, contributorEntityId, contributions[]
`;

/**
 * Creates a tool that executes a game action on chain via the adapter.
 * Returns the action result including success status and optional txHash.
 */
export function createExecuteActionTool(adapter: GameAdapter<any>): AgentTool<typeof actionSchema> {
	return {
		name: "execute_action",
		label: "Execute Action",
		description: EXECUTE_ACTION_DESCRIPTION,
		parameters: actionSchema,
		async execute(_toolCallId, toolParams) {
			const { actionType, ...params } = toolParams;
			const result = await adapter.executeAction({
				type: actionType,
				params,
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: { actionType, success: result.success },
			};
		},
	};
}

const simulateSchema = Type.Object({
	actionType: StringEnum(ACTION_TYPES, {
		description: "The action to simulate. Same actions and params as execute_action.",
	}),

	// Include the same params as actionSchema for simulation
	senderEntityId: Type.Optional(Type.Number()),
	recipientEntityId: Type.Optional(Type.Number()),
	ownerEntityId: Type.Optional(Type.Number()),
	resources: Type.Optional(Type.Array(Type.Object({
		resourceType: Type.Number(),
		amount: Type.Number(),
	}))),
	day: Type.Optional(Type.Number()),
	resourceCount: Type.Optional(Type.Number()),
	forStructureId: Type.Optional(Type.Number()),
	entityId: Type.Optional(Type.Number()),
	structureId: Type.Optional(Type.Number()),
	category: Type.Optional(Type.Number()),
	tier: Type.Optional(Type.Number()),
	amount: Type.Optional(Type.Number()),
	slot: Type.Optional(Type.Number()),
	spawnDirection: Type.Optional(Type.Number()),
	explorerId: Type.Optional(Type.Number()),
	toExplorerId: Type.Optional(Type.Number()),
	homeDirection: Type.Optional(Type.Number()),
	directions: Type.Optional(Type.Array(Type.Number())),
	explore: Type.Optional(Type.Boolean()),
	fromExplorerId: Type.Optional(Type.Number()),
	toExplorerDirection: Type.Optional(Type.Number()),
	count: Type.Optional(Type.Number()),
	toStructureId: Type.Optional(Type.Number()),
	toStructureDirection: Type.Optional(Type.Number()),
	toGuardSlot: Type.Optional(Type.Number()),
	fromStructureId: Type.Optional(Type.Number()),
	fromGuardSlot: Type.Optional(Type.Number()),
	aggressorId: Type.Optional(Type.Number()),
	defenderId: Type.Optional(Type.Number()),
	defenderDirection: Type.Optional(Type.Number()),
	stealResources: Type.Optional(Type.Array(Type.Object({
		resourceId: Type.Number(),
		amount: Type.Number(),
	}))),
	structureDirection: Type.Optional(Type.Number()),
	structureGuardSlot: Type.Optional(Type.Number()),
	explorerDirection: Type.Optional(Type.Number()),
	makerId: Type.Optional(Type.Number()),
	takerId: Type.Optional(Type.Number()),
	makerGivesResourceType: Type.Optional(Type.Number()),
	takerPaysResourceType: Type.Optional(Type.Number()),
	makerGivesMinResourceAmount: Type.Optional(Type.Number()),
	makerGivesMaxCount: Type.Optional(Type.Number()),
	takerPaysMinResourceAmount: Type.Optional(Type.Number()),
	expiresAt: Type.Optional(Type.Number()),
	tradeId: Type.Optional(Type.Number()),
	takerBuysCount: Type.Optional(Type.Number()),
	buildingCategory: Type.Optional(Type.Number()),
	useSimple: Type.Optional(Type.Boolean()),
	buildingCoord: Type.Optional(Type.Object({
		x: Type.Number(),
		y: Type.Number(),
	})),
	bankEntityId: Type.Optional(Type.Number()),
	resourceType: Type.Optional(Type.Number()),
	shares: Type.Optional(Type.Number()),
	calls: Type.Optional(Type.Array(Type.Object({
		resourceType: Type.Number(),
		resourceAmount: Type.Number(),
		lordsAmount: Type.Number(),
	}))),
	isPublic: Type.Optional(Type.Boolean()),
	guildName: Type.Optional(Type.String()),
	guildEntityId: Type.Optional(Type.Number()),
	address: Type.Optional(Type.String()),
	whitelist: Type.Optional(Type.Boolean()),
	realmEntityId: Type.Optional(Type.Number()),
	hyperstructureEntityId: Type.Optional(Type.Number()),
	contributorEntityId: Type.Optional(Type.Number()),
	contributions: Type.Optional(Type.Array(Type.Number())),
});

/**
 * Creates a tool that simulates a game action (dry run) without executing on chain.
 * Returns predicted outcome and cost estimates.
 */
export function createSimulateActionTool(adapter: GameAdapter<any>): AgentTool<typeof simulateSchema> {
	return {
		name: "simulate_action",
		label: "Simulate Action",
		description: "Simulate a game action without executing it. Returns predicted outcome and cost estimates. Same params as execute_action.",
		parameters: simulateSchema,
		async execute(_toolCallId, toolParams) {
			const { actionType, ...params } = toolParams;
			const result = await adapter.simulateAction({
				type: actionType,
				params,
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
