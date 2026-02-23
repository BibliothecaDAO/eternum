import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { EternumClient } from "@bibliothecadao/client";
import { RESOURCE_BALANCE_COLUMNS, TROOP_BALANCE_COLUMNS } from "@bibliothecadao/torii";
import { parseHexBig, BUILDING_NAMES, unpackBuildingCountsFromHex } from "../adapter/world-state";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

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
 * Serialize a view result, truncating if it exceeds a reasonable size for the LLM context.
 * Most views are fine, but mapArea or market with many entries could get large.
 */
function serializeView(data: unknown, maxChars = 8000): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length <= maxChars) return json;
  return json.slice(0, maxChars) + `\n... (truncated, ${json.length} chars total)`;
}

/** Log what the agent sees from tool calls. */
function logToolResponse(toolName: string, params: any, response: string) {
  try {
    const debugPath = join(
      process.env.AGENT_DATA_DIR || join(process.env.HOME || "/tmp", ".eternum-agent", "data"),
      "debug",
      "tool-responses.log",
    );
    mkdirSync(dirname(debugPath), { recursive: true });
    const ts = new Date().toISOString();
    const paramStr = params ? JSON.stringify(params) : "";
    writeFileSync(debugPath, `\n[${ts}] ${toolName}(${paramStr})\n${response}\n`, { flag: "a" });
  } catch (_) {}
}

const RESOURCE_PRECISION = 1_000_000_000;

/**
 * Inspect a specific realm/structure — returns full detail including resources,
 * production rates, buildings with costs, guard slots, explorers, arrivals, and orders.
 *
 * Enriches base ViewClient data with direct SQL queries for resource balances,
 * production building counts, troop reserves, and building details.
 */
function createInspectRealmTool(client: EternumClient): AgentTool<any> {
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
        // Fetch base realm view and SQL enrichment data in parallel
        const [realm, balanceRows, buildingRows] = await Promise.all([
          client.view.realm(entityId),
          client.sql.fetchResourceBalances([entityId]).catch(() => [] as any[]),
          (client.sql as any).fetchBuildingsByStructures?.([entityId]).catch(() => [] as any[]) ?? Promise.resolve([] as any[]),
        ]);

        const realmData = realm as any;

        // Enrich with resource balances and production from SQL
        const balanceRow = (balanceRows as any[])?.[0];
        if (balanceRow) {
          const resources: Record<string, number> = {};
          const productions: string[] = [];
          const troopReserves: string[] = [];

          for (const col of RESOURCE_BALANCE_COLUMNS) {
            const hexVal = balanceRow[col.column];
            if (hexVal && hexVal !== "0x0") {
              const amount = Number(parseHexBig(hexVal) / BigInt(RESOURCE_PRECISION));
              if (amount > 0) {
                resources[col.name] = amount;
              }
            }
            // Production building count
            const prodCol = `${col.column.replace("_BALANCE", "_PRODUCTION")}.building_count`;
            const buildingCount = Number(balanceRow[prodCol] ?? 0);
            if (buildingCount > 0) {
              productions.push(`${col.name} x${buildingCount}`);
            }
          }

          for (const col of TROOP_BALANCE_COLUMNS) {
            const hexVal = balanceRow[col.column];
            if (hexVal && hexVal !== "0x0") {
              const amount = Number(parseHexBig(hexVal) / BigInt(RESOURCE_PRECISION));
              if (amount > 0) {
                troopReserves.push(`${col.name}: ${amount}`);
              }
            }
          }

          if (Object.keys(resources).length > 0) realmData.resources = resources;
          if (productions.length > 0) realmData.productions = productions;
          if (troopReserves.length > 0) realmData.troopReserves = troopReserves;
        }

        // Enrich with building details from SQL
        const buildings = buildingRows as any[];
        if (buildings.length > 0) {
          realmData.buildings = buildings.map((b: any) => {
            const catId = Number(b.building_category ?? 0);
            return {
              category: BUILDING_NAMES[catId] ?? `Type${catId}`,
              categoryId: catId,
              innerCol: b.inner_col,
              innerRow: b.inner_row,
              paused: Boolean(b.paused),
            };
          });
        }

        const text = serializeView(realmData);
        logToolResponse("inspect_realm", { entityId }, text);
        return {
          content: [{ type: "text", text }],
          details: { entityId, found: true },
        };
      } catch (err: any) {
        const text = `Error inspecting realm ${entityId}: ${err?.message ?? err}`;
        logToolResponse("inspect_realm", { entityId }, text);
        return {
          content: [{ type: "text", text }],
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
function createInspectExplorerTool(client: EternumClient): AgentTool<any> {
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
        const text = serializeView(explorer);
        logToolResponse("inspect_explorer", { entityId }, text);
        return {
          content: [{ type: "text", text }],
          details: { entityId, found: true },
        };
      } catch (err: any) {
        const text = `Error inspecting explorer ${entityId}: ${err?.message ?? err}`;
        logToolResponse("inspect_explorer", { entityId }, text);
        return {
          content: [{ type: "text", text }],
          details: { entityId, found: false },
        };
      }
    },
  };
}

/**
 * Inspect the market — AMM pool states, recent swaps, open orders, and player LP positions.
 */
function createInspectMarketTool(client: EternumClient): AgentTool<any> {
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
        const text = serializeView(market);
        logToolResponse("inspect_market", {}, text);
        return {
          content: [{ type: "text", text }],
          details: { found: true },
        };
      } catch (err: any) {
        const text = `Error inspecting market: ${err?.message ?? err}`;
        logToolResponse("inspect_market", {}, text);
        return {
          content: [{ type: "text", text }],
          details: { found: false },
        };
      }
    },
  };
}

/**
 * Inspect a bank — pool states, recent swaps, and LP positions at a specific bank.
 */
function createInspectBankTool(client: EternumClient): AgentTool<any> {
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
        const text = serializeView(bank);
        logToolResponse("inspect_bank", { bankEntityId }, text);
        return {
          content: [{ type: "text", text }],
          details: { bankEntityId, found: true },
        };
      } catch (err: any) {
        const text = `Error inspecting bank ${bankEntityId}: ${err?.message ?? err}`;
        logToolResponse("inspect_bank", { bankEntityId }, text);
        return {
          content: [{ type: "text", text }],
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
