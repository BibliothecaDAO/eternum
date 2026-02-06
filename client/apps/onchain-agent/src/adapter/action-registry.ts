import type { EternumClient } from "@bibliothecadao/client";
import type { ActionResult, GameAction } from "@mariozechner/pi-onchain-agent";
import type { Account } from "starknet";

export type ActionHandler = (
  client: EternumClient,
  signer: Account,
  params: Record<string, unknown>,
) => Promise<ActionResult>;

// ---------------------------------------------------------------------------
// Registry internals
// ---------------------------------------------------------------------------

const registry = new Map<string, ActionHandler>();

function register(type: string, handler: ActionHandler) {
  registry.set(type, handler);
}

function registerAliases(types: string[], handler: ActionHandler) {
  for (const type of types) {
    register(type, handler);
  }
}

/**
 * Wrap an async client transaction call into a normalised ActionResult.
 * Handles both `transaction_hash` and `transactionHash` return shapes.
 */
async function wrapTx(fn: () => Promise<any>): Promise<ActionResult> {
  try {
    const result = await fn();
    return {
      success: true,
      txHash: result?.transaction_hash ?? result?.transactionHash ?? undefined,
      data: result,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? String(err),
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

function liquidityCalls(
  v: unknown,
): { resourceType: number; resourceAmount: number; lordsAmount: number }[] {
  if (!Array.isArray(v)) return [];
  return v.map((c: any) => ({
    resourceType: num(c.resourceType ?? c.resource_type ?? 0),
    resourceAmount: num(c.resourceAmount ?? c.resource_amount ?? 0),
    lordsAmount: num(c.lordsAmount ?? c.lords_amount ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

register("send_resources", (client, signer, p) =>
  wrapTx(() =>
    client.resources.send(signer, {
      senderEntityId: num(p.senderEntityId),
      recipientEntityId: num(p.recipientEntityId),
      resources: resourceList(p.resources),
    }),
  ),
);

register("pickup_resources", (client, signer, p) =>
  wrapTx(() =>
    client.resources.pickup(signer, {
      recipientEntityId: num(p.recipientEntityId),
      ownerEntityId: num(p.ownerEntityId),
      resources: resourceList(p.resources),
    }),
  ),
);

register("claim_arrivals", (client, signer, p) =>
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

register("create_explorer", (client, signer, p) =>
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

register("add_to_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.troops.addToExplorer(signer, {
      toExplorerId: num(p.toExplorerId),
      amount: num(p.amount),
      homeDirection: num(p.homeDirection),
    }),
  ),
);

register("delete_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.troops.deleteExplorer(signer, {
      explorerId: num(p.explorerId),
    }),
  ),
);

register("add_guard", (client, signer, p) =>
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

register("delete_guard", (client, signer, p) =>
  wrapTx(() =>
    client.troops.deleteGuard(signer, {
      forStructureId: num(p.forStructureId),
      slot: num(p.slot),
    }),
  ),
);

register("move_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.troops.move(signer, {
      explorerId: num(p.explorerId),
      directions: numArray(p.directions),
      explore: bool(p.explore),
    }),
  ),
);

register("travel_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.troops.travel(signer, {
      explorerId: num(p.explorerId),
      directions: numArray(p.directions),
    }),
  ),
);

register("explore", (client, signer, p) =>
  wrapTx(() =>
    client.troops.explore(signer, {
      explorerId: num(p.explorerId),
      directions: numArray(p.directions),
    }),
  ),
);

register("swap_explorer_to_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.troops.swapExplorerToExplorer(signer, {
      fromExplorerId: num(p.fromExplorerId),
      toExplorerId: num(p.toExplorerId),
      toExplorerDirection: num(p.toExplorerDirection),
      count: num(p.count),
    }),
  ),
);

register("swap_explorer_to_guard", (client, signer, p) =>
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

register("swap_guard_to_explorer", (client, signer, p) =>
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

register("attack_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.combat.attackExplorer(signer, {
      aggressorId: num(p.aggressorId),
      defenderId: num(p.defenderId),
      defenderDirection: num(p.defenderDirection),
      stealResources: stealResourceList(p.stealResources),
    }),
  ),
);

register("attack_guard", (client, signer, p) =>
  wrapTx(() =>
    client.combat.attackGuard(signer, {
      explorerId: num(p.explorerId),
      structureId: num(p.structureId),
      structureDirection: num(p.structureDirection),
    }),
  ),
);

register("guard_attack_explorer", (client, signer, p) =>
  wrapTx(() =>
    client.combat.guardAttackExplorer(signer, {
      structureId: num(p.structureId),
      structureGuardSlot: num(p.structureGuardSlot),
      explorerId: num(p.explorerId),
      explorerDirection: num(p.explorerDirection),
    }),
  ),
);

register("raid", (client, signer, p) =>
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

const acceptOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.acceptOrder(signer, {
      takerId: num(p.takerId),
      tradeId: num(p.tradeId),
      takerBuysCount: num(p.takerBuysCount),
    }),
  );

const cancelOrderHandler: ActionHandler = (client, signer, p) =>
  wrapTx(() =>
    client.trade.cancelOrder(signer, {
      tradeId: num(p.tradeId),
    }),
  );

registerAliases(["create_order", "create_trade"], createOrderHandler);
registerAliases(["accept_order", "accept_trade"], acceptOrderHandler);
registerAliases(["cancel_order", "cancel_trade"], cancelOrderHandler);

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

register("create_building", (client, signer, p) =>
  wrapTx(() =>
    client.buildings.create(signer, {
      entityId: num(p.entityId),
      directions: numArray(p.directions),
      buildingCategory: num(p.buildingCategory),
      useSimple: bool(p.useSimple),
    }),
  ),
);

register("destroy_building", (client, signer, p) =>
  wrapTx(() =>
    client.buildings.destroy(signer, {
      entityId: num(p.entityId),
      buildingCoord: buildingCoord(p.buildingCoord),
    }),
  ),
);

register("pause_production", (client, signer, p) =>
  wrapTx(() =>
    client.buildings.pauseProduction(signer, {
      entityId: num(p.entityId),
      buildingCoord: buildingCoord(p.buildingCoord),
    }),
  ),
);

register("resume_production", (client, signer, p) =>
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

register("buy_resources", (client, signer, p) =>
  wrapTx(() =>
    client.bank.buy(signer, {
      bankEntityId: num(p.bankEntityId),
      entityId: num(p.entityId),
      resourceType: num(p.resourceType),
      amount: num(p.amount),
    }),
  ),
);

register("sell_resources", (client, signer, p) =>
  wrapTx(() =>
    client.bank.sell(signer, {
      bankEntityId: num(p.bankEntityId),
      entityId: num(p.entityId),
      resourceType: num(p.resourceType),
      amount: num(p.amount),
    }),
  ),
);

register("add_liquidity", (client, signer, p) =>
  wrapTx(() =>
    client.bank.addLiquidity(signer, {
      bankEntityId: num(p.bankEntityId),
      entityId: num(p.entityId),
      calls: liquidityCalls(p.calls),
    }),
  ),
);

register("remove_liquidity", (client, signer, p) =>
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

register("create_guild", (client, signer, p) =>
  wrapTx(() =>
    client.guild.create(signer, {
      isPublic: bool(p.isPublic),
      guildName: str(p.guildName ?? p.name ?? ""),
    }),
  ),
);

register("join_guild", (client, signer, p) =>
  wrapTx(() =>
    client.guild.join(signer, {
      guildEntityId: num(p.guildEntityId),
    }),
  ),
);

register("leave_guild", (client, signer, _p) =>
  wrapTx(() => client.guild.leave(signer)),
);

register("update_whitelist", (client, signer, p) =>
  wrapTx(() =>
    client.guild.updateWhitelist(signer, {
      address: num(p.address),
      whitelist: bool(p.whitelist),
    }),
  ),
);

// ---------------------------------------------------------------------------
// Realm
// ---------------------------------------------------------------------------

register("upgrade_realm", (client, signer, p) =>
  wrapTx(() =>
    client.realm.upgrade(signer, {
      realmEntityId: num(p.realmEntityId),
    }),
  ),
);

// ---------------------------------------------------------------------------
// Hyperstructure
// ---------------------------------------------------------------------------

register("contribute_hyperstructure", (client, signer, p) =>
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
  return registry.get(type);
}

/**
 * Return the list of all registered action type strings.
 */
export function getAvailableActions(): string[] {
  return Array.from(registry.keys());
}

/**
 * Execute a GameAction by dispatching to the matching registered handler.
 * Returns a failed ActionResult if the action type is unknown.
 */
export async function executeAction(
  client: EternumClient,
  signer: Account,
  action: GameAction,
): Promise<ActionResult> {
  const handler = registry.get(action.type);
  if (!handler) {
    return { success: false, error: `Unknown action type: ${action.type}` };
  }
  return handler(client, signer, action.params);
}
