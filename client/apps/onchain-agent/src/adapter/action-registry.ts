import type { EternumClient } from "@bibliothecadao/client";
import type { ActionResult, GameAction } from "@bibliothecadao/game-agent";

// Re-declared here to avoid tsup d.ts resolution issues with game-agent.
// These types mirror the canonical definitions in @bibliothecadao/game-agent/types.
interface ActionParamSchema {
  name: string;
  type: "number" | "string" | "boolean" | "number[]" | "object[]" | "bigint";
  description: string;
  required?: boolean;
}

export interface ActionDefinition {
  type: string;
  description: string;
  params: ActionParamSchema[];
}
import type { Account } from "starknet";

export type ActionHandler = (
  client: EternumClient,
  signer: Account,
  params: Record<string, unknown>,
) => Promise<ActionResult>;

// ---------------------------------------------------------------------------
// Registry internals
// ---------------------------------------------------------------------------

interface RegistryEntry {
  handler: ActionHandler;
  definition: ActionDefinition;
}

const registry = new Map<string, RegistryEntry>();

function register(type: string, description: string, params: ActionParamSchema[], handler: ActionHandler) {
  registry.set(type, { handler, definition: { type, description, params } });
}

function registerAliases(types: string[], description: string, params: ActionParamSchema[], handler: ActionHandler) {
  // All aliases share a single definition (using the first type as canonical)
  const definition: ActionDefinition = { type: types[0], description, params };
  for (const type of types) {
    registry.set(type, { handler, definition });
  }
}

// ---------------------------------------------------------------------------
// Param schema helpers
// ---------------------------------------------------------------------------

const n = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "number",
  description,
  required,
});

const s = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "string",
  description,
  required,
});

const b = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "boolean",
  description,
  required,
});

const na = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "number[]",
  description,
  required,
});

const oa = (name: string, description: string, required = true): ActionParamSchema => ({
  name,
  type: "object[]",
  description,
  required,
});

/**
 * Extract a short, human-readable error from a Starknet error.
 * Starknet errors often contain huge execution traces; we pull out the useful bit.
 */
function extractErrorMessage(err: any): string {
  const raw = err?.message ?? String(err);

  // Look for "Failure reason:" pattern common in Starknet reverts
  const failureMatch = raw.match(/Failure reason:\s*"?([^"]+)"?/i);
  if (failureMatch) return failureMatch[1].trim();

  // Look for "execution reverted" with a reason
  const revertMatch = raw.match(/execution reverted[:\s]*(.+?)(?:\n|$)/i);
  if (revertMatch) return `Reverted: ${revertMatch[1].trim()}`;

  // Look for Cairo panic/assert messages
  const cairoMatch = raw.match(/(?:assert|panic)[:\s]+(.+?)(?:\n|$)/i);
  if (cairoMatch) return cairoMatch[1].trim();

  // Truncate generic long errors to something readable
  const firstLine = raw.split("\n")[0].trim();
  if (firstLine.length > 200) return firstLine.slice(0, 200) + "...";
  return firstLine;
}

/**
 * Wrap an async client transaction call into a normalised ActionResult.
 * Handles both `transaction_hash` and `transactionHash` return shapes.
 * Strips raw chain data from success responses and extracts readable errors.
 */
async function wrapTx(fn: () => Promise<any>): Promise<ActionResult> {
  try {
    const result = await fn();
    const txHash = result?.transaction_hash ?? result?.transactionHash ?? undefined;
    return {
      success: true,
      txHash,
      // Only include minimal confirmation data, not the full chain response
      data: txHash ? { transactionHash: txHash } : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      error: extractErrorMessage(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers – coerce unknown params from the LLM into typed values
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  return Number(v);
}

function str(v: unknown): string {
  return String(v);
}

function bool(v: unknown): boolean {
  if (typeof v === "string") return v === "true" || v === "1";
  return Boolean(v);
}

function bigNumberish(v: unknown): string | bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid numeric value '${v}'`);
    }
    return BigInt(Math.trunc(v));
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) {
      throw new Error("Address cannot be empty");
    }
    return trimmed;
  }
  throw new Error(`Unsupported BigNumberish value type '${typeof v}'`);
}

function numArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(num);
  return [];
}

function resourceList(v: unknown): { resourceType: number; amount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => ({
    resourceType: num(r.resourceType ?? r.resource_type ?? r.resourceId ?? 0),
    amount: num(r.amount ?? 0),
  }));
}

function stealResourceList(v: unknown): { resourceId: number; amount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((r: any) => ({
    resourceId: num(r.resourceId ?? r.resource_id ?? r.resourceType ?? 0),
    amount: num(r.amount ?? 0),
  }));
}

function buildingCoord(v: unknown): { alt?: boolean; x: number; y: number } {
  const c = v as any;
  return {
    alt: c?.alt != null ? bool(c.alt) : undefined,
    x: num(c?.x ?? 0),
    y: num(c?.y ?? 0),
  };
}

function liquidityCalls(v: unknown): { resourceType: number; resourceAmount: number; lordsAmount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((c: any) => ({
    resourceType: num(c.resourceType ?? c.resource_type ?? 0),
    resourceAmount: num(c.resourceAmount ?? c.resource_amount ?? 0),
    lordsAmount: num(c.lordsAmount ?? c.lords_amount ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Shared reference strings for enum-valued params
// ---------------------------------------------------------------------------

const RESOURCE_IDS =
  "Resource IDs: 1=Stone, 2=Coal, 3=Wood, 4=Copper, 5=Ironwood, 6=Obsidian, 7=Gold, 8=Silver, " +
  "9=Mithral, 10=AlchemicalSilver, 11=ColdIron, 12=DeepCrystal, 13=Ruby, 14=Diamonds, " +
  "15=Hartwood, 16=Ignium, 17=TwilightQuartz, 18=TrueIce, 19=Adamantine, 20=Sapphire, " +
  "21=EtherealSilica, 22=Dragonhide, 23=Labor, 24=AncientFragment, 25=Donkey, " +
  "26=Knight, 27=KnightT2, 28=KnightT3, 29=Crossbowman, 30=CrossbowmanT2, 31=CrossbowmanT3, " +
  "32=Paladin, 33=PaladinT2, 34=PaladinT3, 35=Wheat, 36=Fish, 37=Lords, 38=Essence";

const BUILDING_TYPES =
  "Building IDs: 0=None, 1=WorkersHut, 2=Storehouse, 3=Stone, 4=Coal, 5=Wood, 6=Copper, " +
  "7=Ironwood, 8=Obsidian, 9=Gold, 10=Silver, 11=Mithral, 12=AlchemicalSilver, 13=ColdIron, " +
  "14=DeepCrystal, 15=Ruby, 16=Diamonds, 17=Hartwood, 18=Ignium, 19=TwilightQuartz, " +
  "20=TrueIce, 21=Adamantine, 22=Sapphire, 23=EtherealSilica, 24=Dragonhide, 25=Labor, " +
  "26=AncientFragment, 27=Donkey, 28=KnightT1, 29=KnightT2, 30=KnightT3, " +
  "31=CrossbowmanT1, 32=CrossbowmanT2, 33=CrossbowmanT3, 34=PaladinT1, 35=PaladinT2, " +
  "36=PaladinT3, 37=Wheat, 38=Fish, 39=Essence";

const DIR = "0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE";

const TROOP_CATEGORY = "0=Knight, 1=Paladin, 2=Crossbowman";

const TROOP_TIER = "0=T1, 1=T2, 2=T3";

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

register(
  "send_resources",
  "Send resources from one entity to another",
  [
    n("senderEntityId", "Entity ID of the sender"),
    n("recipientEntityId", "Entity ID of the recipient"),
    oa("resources", `Array of {resourceType, amount} to send. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.resources.send(signer, {
        senderEntityId: num(p.senderEntityId),
        recipientEntityId: num(p.recipientEntityId),
        resources: resourceList(p.resources),
      }),
    ),
);

register(
  "pickup_resources",
  "Pick up resources from an entity you own",
  [
    n("recipientEntityId", "Entity ID receiving the resources"),
    n("ownerEntityId", "Entity ID that owns the resources"),
    oa("resources", `Array of {resourceType, amount} to pick up. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.resources.pickup(signer, {
        recipientEntityId: num(p.recipientEntityId),
        ownerEntityId: num(p.ownerEntityId),
        resources: resourceList(p.resources),
      }),
    ),
);

register(
  "claim_arrivals",
  "Claim incoming resource arrivals at a structure",
  [
    n("structureId", "Structure entity ID to claim at"),
    n("day", "Day index"),
    n("slot", "Slot index"),
    n("resourceCount", "Number of resources to claim"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.resources.claimArrivals(signer, {
        structureId: num(p.structureId),
        day: num(p.day),
        slot: num(p.slot),
        resourceCount: num(p.resourceCount),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Troops
// ---------------------------------------------------------------------------

register(
  "create_explorer",
  "Create a new explorer troop from a structure",
  [
    n("forStructureId", "Structure entity ID to spawn from"),
    n("category", `Troop category (${TROOP_CATEGORY})`),
    n("tier", `Troop tier (${TROOP_TIER}; higher is stronger)`),
    n("amount", "Number of troops to create"),
    n("spawnDirection", `Hex direction (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.createExplorer(signer, {
        forStructureId: num(p.forStructureId),
        category: num(p.category),
        tier: num(p.tier),
        amount: num(p.amount),
        spawnDirection: num(p.spawnDirection),
      }),
    ),
);

register(
  "add_to_explorer",
  "Add more troops to an existing explorer",
  [
    n("toExplorerId", "Explorer entity ID to reinforce"),
    n("amount", "Number of troops to add"),
    n("homeDirection", `Direction back to home structure (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.addToExplorer(signer, {
        toExplorerId: num(p.toExplorerId),
        amount: num(p.amount),
        homeDirection: num(p.homeDirection),
      }),
    ),
);

register(
  "delete_explorer",
  "Delete an explorer and return troops to structure",
  [n("explorerId", "Explorer entity ID to delete")],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.deleteExplorer(signer, {
        explorerId: num(p.explorerId),
      }),
    ),
);

register(
  "add_guard",
  "Add a guard troop to a structure's defense slot",
  [
    n("forStructureId", "Structure entity ID to guard"),
    n("slot", "Guard slot index (0-3, depends on structure max guards)"),
    n("category", `Troop category (${TROOP_CATEGORY})`),
    n("tier", `Troop tier (${TROOP_TIER})`),
    n("amount", "Number of troops"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.addGuard(signer, {
        forStructureId: num(p.forStructureId),
        slot: num(p.slot),
        category: num(p.category),
        tier: num(p.tier),
        amount: num(p.amount),
      }),
    ),
);

register(
  "delete_guard",
  "Remove a guard from a structure's defense slot",
  [n("forStructureId", "Structure entity ID"), n("slot", "Guard slot index to clear (0-3)")],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.deleteGuard(signer, {
        forStructureId: num(p.forStructureId),
        slot: num(p.slot),
      }),
    ),
);

register(
  "move_explorer",
  "Move an explorer along hex directions (optionally exploring)",
  [
    n("explorerId", "Explorer entity ID"),
    na("directions", `Array of hex directions (${DIR})`),
    b("explore", "Whether to explore (discover new tiles) while moving"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.move(signer, {
        explorerId: num(p.explorerId),
        directions: numArray(p.directions),
        explore: bool(p.explore),
      }),
    ),
);

register(
  "travel_explorer",
  "Travel an explorer along hex directions (no exploration)",
  [n("explorerId", "Explorer entity ID"), na("directions", `Array of hex directions (${DIR})`)],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.travel(signer, {
        explorerId: num(p.explorerId),
        directions: numArray(p.directions),
      }),
    ),
);

register(
  "explore",
  "Explore new tiles with an explorer",
  [n("explorerId", "Explorer entity ID"), na("directions", `Array of hex directions (${DIR})`)],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.explore(signer, {
        explorerId: num(p.explorerId),
        directions: numArray(p.directions),
      }),
    ),
);

register(
  "swap_explorer_to_explorer",
  "Transfer troops between two explorers",
  [
    n("fromExplorerId", "Source explorer entity ID"),
    n("toExplorerId", "Destination explorer entity ID"),
    n("toExplorerDirection", `Hex direction (${DIR})`),
    n("count", "Number of troops to transfer"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.swapExplorerToExplorer(signer, {
        fromExplorerId: num(p.fromExplorerId),
        toExplorerId: num(p.toExplorerId),
        toExplorerDirection: num(p.toExplorerDirection),
        count: num(p.count),
      }),
    ),
);

register(
  "swap_explorer_to_guard",
  "Transfer troops from an explorer to a structure guard slot",
  [
    n("fromExplorerId", "Source explorer entity ID"),
    n("toStructureId", "Destination structure entity ID"),
    n("toStructureDirection", `Hex direction (${DIR})`),
    n("toGuardSlot", "Guard slot index at the structure (0-3)"),
    n("count", "Number of troops to transfer"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.swapExplorerToGuard(signer, {
        fromExplorerId: num(p.fromExplorerId),
        toStructureId: num(p.toStructureId),
        toStructureDirection: num(p.toStructureDirection),
        toGuardSlot: num(p.toGuardSlot),
        count: num(p.count),
      }),
    ),
);

register(
  "swap_guard_to_explorer",
  "Transfer troops from a structure guard slot to an explorer",
  [
    n("fromStructureId", "Source structure entity ID"),
    n("fromGuardSlot", "Guard slot index at the structure (0-3)"),
    n("toExplorerId", "Destination explorer entity ID"),
    n("toExplorerDirection", `Hex direction (${DIR})`),
    n("count", "Number of troops to transfer"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.troops.swapGuardToExplorer(signer, {
        fromStructureId: num(p.fromStructureId),
        fromGuardSlot: num(p.fromGuardSlot),
        toExplorerId: num(p.toExplorerId),
        toExplorerDirection: num(p.toExplorerDirection),
        count: num(p.count),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

register(
  "attack_explorer",
  "Attack another explorer with your explorer (costs 50 stamina attacker, 40 defender)",
  [
    n("aggressorId", "Your explorer entity ID"),
    n("defenderId", "Target explorer entity ID"),
    n("defenderDirection", `Hex direction (${DIR})`),
    oa("stealResources", `Array of {resourceId, amount} to steal on victory. ${RESOURCE_IDS}`, false),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.attackExplorer(signer, {
        aggressorId: num(p.aggressorId),
        defenderId: num(p.defenderId),
        defenderDirection: num(p.defenderDirection),
        stealResources: stealResourceList(p.stealResources),
      }),
    ),
);

register(
  "attack_guard",
  "Attack a structure's guard with your explorer",
  [
    n("explorerId", "Your explorer entity ID"),
    n("structureId", "Target structure entity ID"),
    n("structureDirection", `Hex direction (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.attackGuard(signer, {
        explorerId: num(p.explorerId),
        structureId: num(p.structureId),
        structureDirection: num(p.structureDirection),
      }),
    ),
);

register(
  "guard_attack_explorer",
  "Use a structure's guard to attack a nearby explorer",
  [
    n("structureId", "Your structure entity ID"),
    n("structureGuardSlot", "Guard slot index (0-3, depends on structure max guards)"),
    n("explorerId", "Target explorer entity ID"),
    n("explorerDirection", `Hex direction (${DIR})`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.guardAttackExplorer(signer, {
        structureId: num(p.structureId),
        structureGuardSlot: num(p.structureGuardSlot),
        explorerId: num(p.explorerId),
        explorerDirection: num(p.explorerDirection),
      }),
    ),
);

register(
  "raid",
  "Raid a structure to steal resources (without destroying guard)",
  [
    n("explorerId", "Your explorer entity ID"),
    n("structureId", "Target structure entity ID"),
    n("structureDirection", `Hex direction (${DIR})`),
    oa("stealResources", `Array of {resourceId, amount} to steal. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.combat.raid(signer, {
        explorerId: num(p.explorerId),
        structureId: num(p.structureId),
        structureDirection: num(p.structureDirection),
        stealResources: stealResourceList(p.stealResources),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

const createOrderParams: ActionParamSchema[] = [
  n("makerId", "Your structure entity ID offering resources"),
  n("takerId", "Target structure entity ID (0 for open market)"),
  n("makerGivesResourceType", `Resource type ID you are offering. ${RESOURCE_IDS}`),
  n("takerPaysResourceType", `Resource type ID you want in return. ${RESOURCE_IDS}`),
  n("makerGivesMinResourceAmount", "Minimum amount per trade unit"),
  n("makerGivesMaxCount", "Maximum number of trade units"),
  n("takerPaysMinResourceAmount", "Minimum payment per trade unit"),
  n("expiresAt", "Expiration timestamp"),
];

const createOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.createOrder(signer, {
      makerId: num(p.makerId),
      takerId: num(p.takerId),
      makerGivesResourceType: num(p.makerGivesResourceType),
      takerPaysResourceType: num(p.takerPaysResourceType),
      makerGivesMinResourceAmount: num(p.makerGivesMinResourceAmount),
      makerGivesMaxCount: num(p.makerGivesMaxCount),
      takerPaysMinResourceAmount: num(p.takerPaysMinResourceAmount),
      expiresAt: num(p.expiresAt),
    }),
  );

const acceptOrderParams: ActionParamSchema[] = [
  n("takerId", "Your structure entity ID accepting the trade"),
  n("tradeId", "Trade order ID to accept"),
  n("takerBuysCount", "Number of trade units to buy"),
];

const acceptOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.acceptOrder(signer, {
      takerId: num(p.takerId),
      tradeId: num(p.tradeId),
      takerBuysCount: num(p.takerBuysCount),
    }),
  );

const cancelOrderParams: ActionParamSchema[] = [n("tradeId", "Trade order ID to cancel")];

const cancelOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.cancelOrder(signer, {
      tradeId: num(p.tradeId),
    }),
  );

registerAliases(
  ["create_order", "create_trade"],
  "Create a trade order on the market",
  createOrderParams,
  createOrderHandler,
);
registerAliases(
  ["accept_order", "accept_trade"],
  "Accept an existing trade order",
  acceptOrderParams,
  acceptOrderHandler,
);
registerAliases(["cancel_order", "cancel_trade"], "Cancel your trade order", cancelOrderParams, cancelOrderHandler);

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

register(
  "create_building",
  "Build a new building at a structure",
  [
    n("entityId", "Structure entity ID to build at"),
    na("directions", `Hex directions to building location (${DIR})`),
    n("buildingCategory", `Building category ID. ${BUILDING_TYPES}`),
    b("useSimple", "Use simple (cheaper) building variant"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.create(signer, {
        entityId: num(p.entityId),
        directions: numArray(p.directions),
        buildingCategory: num(p.buildingCategory),
        useSimple: bool(p.useSimple),
      }),
    ),
);

register(
  "destroy_building",
  "Destroy a building at a structure",
  [
    n("entityId", "Structure entity ID"),
    { name: "buildingCoord", type: "object[]" as any, description: "Building coordinate {x, y, alt?}" },
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.destroy(signer, {
        entityId: num(p.entityId),
        buildingCoord: buildingCoord(p.buildingCoord),
      }),
    ),
);

register(
  "pause_production",
  "Pause production at a building",
  [
    n("entityId", "Structure entity ID"),
    { name: "buildingCoord", type: "object[]" as any, description: "Building coordinate {x, y, alt?}" },
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.pauseProduction(signer, {
        entityId: num(p.entityId),
        buildingCoord: buildingCoord(p.buildingCoord),
      }),
    ),
);

register(
  "resume_production",
  "Resume production at a paused building",
  [
    n("entityId", "Structure entity ID"),
    { name: "buildingCoord", type: "object[]" as any, description: "Building coordinate {x, y, alt?}" },
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.buildings.resumeProduction(signer, {
        entityId: num(p.entityId),
        buildingCoord: buildingCoord(p.buildingCoord),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

register(
  "buy_resources",
  "Buy resources from the bank using Lords",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID making the purchase"),
    n("resourceType", `Resource type ID to buy. ${RESOURCE_IDS}`),
    n("amount", "Amount to buy"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.buy(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        resourceType: num(p.resourceType),
        amount: num(p.amount),
      }),
    ),
);

register(
  "sell_resources",
  "Sell resources to the bank for Lords",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID selling"),
    n("resourceType", `Resource type ID to sell. ${RESOURCE_IDS}`),
    n("amount", "Amount to sell"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.sell(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        resourceType: num(p.resourceType),
        amount: num(p.amount),
      }),
    ),
);

register(
  "add_liquidity",
  "Add liquidity to the bank's AMM pool",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID providing liquidity"),
    oa("calls", `Array of {resourceType, resourceAmount, lordsAmount}. ${RESOURCE_IDS}`),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.addLiquidity(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        calls: liquidityCalls(p.calls),
      }),
    ),
);

register(
  "remove_liquidity",
  "Remove liquidity from the bank's AMM pool",
  [
    n("bankEntityId", "Bank entity ID"),
    n("entityId", "Your entity ID"),
    n("resourceType", `Resource type ID. ${RESOURCE_IDS}`),
    n("shares", "Number of LP shares to remove"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.bank.removeLiquidity(signer, {
        bankEntityId: num(p.bankEntityId),
        entityId: num(p.entityId),
        resourceType: num(p.resourceType),
        shares: num(p.shares),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Guild
// ---------------------------------------------------------------------------

register(
  "create_guild",
  "Create a new guild",
  [b("isPublic", "Whether the guild is open to anyone"), s("guildName", "Name for the guild")],
  (client, signer, p) =>
    wrapTx(() =>
      client.guild.create(signer, {
        isPublic: bool(p.isPublic),
        guildName: str(p.guildName ?? p.name ?? ""),
      }),
    ),
);

register("join_guild", "Join an existing guild", [n("guildEntityId", "Guild entity ID to join")], (client, signer, p) =>
  wrapTx(() =>
    client.guild.join(signer, {
      guildEntityId: num(p.guildEntityId),
    }),
  ),
);

register("leave_guild", "Leave your current guild", [], (client, signer, _p) =>
  wrapTx(() => client.guild.leave(signer)),
);

register(
  "update_whitelist",
  "Add or remove an address from guild whitelist",
  [s("address", "Player hex address to whitelist/unwhitelist"), b("whitelist", "true to add, false to remove")],
  (client, signer, p) =>
    wrapTx(() =>
      client.guild.updateWhitelist(signer, {
        address: bigNumberish(p.address),
        whitelist: bool(p.whitelist),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Realm
// ---------------------------------------------------------------------------

register(
  "upgrade_realm",
  "Upgrade your realm to the next level",
  [n("realmEntityId", "Realm entity ID to upgrade")],
  (client, signer, p) =>
    wrapTx(() =>
      client.realm.upgrade(signer, {
        realmEntityId: num(p.realmEntityId),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Hyperstructure
// ---------------------------------------------------------------------------

register(
  "contribute_hyperstructure",
  "Contribute resources to a hyperstructure",
  [
    n("hyperstructureEntityId", "Hyperstructure entity ID"),
    n("contributorEntityId", "Your structure entity ID contributing"),
    na("contributions", "Array of contribution amounts by resource type"),
  ],
  (client, signer, p) =>
    wrapTx(() =>
      client.hyperstructure.contribute(signer, {
        hyperstructureEntityId: num(p.hyperstructureEntityId),
        contributorEntityId: num(p.contributorEntityId),
        contributions: numArray(p.contributions),
      }),
    ),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a registered action handler by its type string.
 */
export function getActionHandler(type: string): ActionHandler | undefined {
  return registry.get(type)?.handler;
}

/**
 * Return the list of all registered action type strings.
 */
export function getAvailableActions(): string[] {
  return Array.from(registry.keys());
}

/**
 * Return all action definitions (type + description + param schemas).
 * Used to build enriched tool descriptions for the LLM.
 */
export function getActionDefinitions(): ActionDefinition[] {
  // Deduplicate by definition reference (aliases share the same handler+def)
  const seen = new Set<ActionDefinition>();
  const defs: ActionDefinition[] = [];
  for (const entry of registry.values()) {
    if (!seen.has(entry.definition)) {
      seen.add(entry.definition);
      defs.push(entry.definition);
    }
  }
  return defs;
}

/**
 * Execute a GameAction by dispatching to the matching registered handler.
 * Returns a failed ActionResult if the action type is unknown.
 */
export async function executeAction(client: EternumClient, signer: Account, action: GameAction): Promise<ActionResult> {
  const entry = registry.get(action.type);
  if (!entry) {
    return { success: false, error: `Unknown action type: ${action.type}` };
  }
  return entry.handler(client, signer, action.params);
}
