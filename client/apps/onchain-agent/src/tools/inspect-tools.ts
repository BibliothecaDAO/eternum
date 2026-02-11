import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { EternumClient } from "@bibliothecadao/client";

// Inline JSON Schema objects (avoids @sinclair/typebox dependency in onchain-agent)
const entityIdSchema = {
  type: "object" as const,
  properties: {
    entityId: { type: "number" as const, description: "The entity ID to inspect" },
  },
  required: ["entityId"],
};

const bankIdSchema = {
  type: "object" as const,
  properties: {
    bankEntityId: { type: "number" as const, description: "The bank entity ID to inspect" },
  },
  required: ["bankEntityId"],
};

const emptySchema = { type: "object" as const, properties: {} };

/**
 * Inspect a specific realm/structure — returns full detail including resources,
 * production rates, buildings with costs, guard slots, explorers, arrivals, and orders.
 */
export function createInspectRealmTool(client: EternumClient): AgentTool<any> {
  return {
    name: "inspect_realm",
    label: "Inspect Realm",
    description:
      "Get detailed info about a specific realm/structure: resource inventories with balances, " +
      "production rates (per tick, active/paused, time remaining), buildings (category, level, " +
      "resource costs), guard troop details per slot (type, tier, count, strength), " +
      "explorer summaries, incoming resource arrivals, outgoing trade orders, relics, " +
      "active battles, and nearby entities.",
    parameters: entityIdSchema,
    async execute(_toolCallId, { entityId }: { entityId: number }) {
      try {
        const realm = await client.view.realm(entityId);
        return {
          content: [{ type: "text", text: JSON.stringify(realm, null, 2) }],
          details: { entityId, found: true },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error inspecting realm ${entityId}: ${err?.message ?? err}` }],
          details: { entityId, found: false },
        };
      }
    },
  };
}

/**
 * Inspect a specific explorer/army — returns stamina, troops, carried resources,
 * battle status, nearby entities, and recent events.
 */
export function createInspectExplorerTool(client: EternumClient): AgentTool<any> {
  return {
    name: "inspect_explorer",
    label: "Inspect Explorer",
    description:
      "Get detailed info about a specific explorer/army: current stamina and max stamina, " +
      "troop composition (type, tier, count per guard slot, total strength), carried resources " +
      "with balances, battle status and current battle reference, nearby entities " +
      "(other explorers, structures), and recent combat/movement events.",
    parameters: entityIdSchema,
    async execute(_toolCallId, { entityId }: { entityId: number }) {
      try {
        const explorer = await client.view.explorer(entityId);
        return {
          content: [{ type: "text", text: JSON.stringify(explorer, null, 2) }],
          details: { entityId, found: true },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error inspecting explorer ${entityId}: ${err?.message ?? err}` }],
          details: { entityId, found: false },
        };
      }
    },
  };
}

/**
 * Inspect the market — AMM pool states, recent swaps, open orders, and player LP positions.
 */
export function createInspectMarketTool(client: EternumClient): AgentTool<any> {
  return {
    name: "inspect_market",
    label: "Inspect Market",
    description:
      "Get current market state: AMM liquidity pool balances and prices per resource, " +
      "recent swap history, open trade orders (with maker/taker/resource types/amounts/expiry), " +
      "and your LP positions.",
    parameters: emptySchema,
    async execute() {
      try {
        const market = await client.view.market();
        return {
          content: [{ type: "text", text: JSON.stringify(market, null, 2) }],
          details: { found: true },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error inspecting market: ${err?.message ?? err}` }],
          details: { found: false },
        };
      }
    },
  };
}

/**
 * Inspect a bank — pool states, recent swaps, and LP positions at a specific bank.
 */
export function createInspectBankTool(client: EternumClient): AgentTool<any> {
  return {
    name: "inspect_bank",
    label: "Inspect Bank",
    description:
      "Get bank details: AMM pool balances/prices for each resource, recent swap activity, " +
      "and your LP positions at a specific bank entity.",
    parameters: bankIdSchema,
    async execute(_toolCallId, { bankEntityId }: { bankEntityId: number }) {
      try {
        const bank = await client.view.bank(bankEntityId);
        return {
          content: [{ type: "text", text: JSON.stringify(bank, null, 2) }],
          details: { bankEntityId, found: true },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error inspecting bank ${bankEntityId}: ${err?.message ?? err}` }],
          details: { bankEntityId, found: false },
        };
      }
    },
  };
}

/**
 * All inspection tools for detailed game state queries.
 */
export function createInspectTools(client: EternumClient): AgentTool<any>[] {
  return [
    createInspectRealmTool(client),
    createInspectExplorerTool(client),
    createInspectMarketTool(client),
    createInspectBankTool(client),
  ];
}
