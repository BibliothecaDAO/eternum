/**
 * PI agent tool wrappers over the core tool functions.
 *
 * Each tool is a thin wrapper: parse params → build core input → call core
 * function → format response as AgentTool output. All game logic lives in
 * `src/tools/core/`.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { ToolContext } from "./core/context.js";
import type { MapContext } from "../map/context.js";
import {
  moveArmy,
  attackTarget,
  simulateAttack,
  createArmy,
  guardFromStorage,
  guardFromArmy,
  unguardToArmy,
  reinforceArmy,
  transferTroops,
  sendResources,
  transferToStructure,
  transferToArmy,
  openChest,
  attackFromGuard,
  raidTarget,
  applyRelic,
} from "./core/index.js";

/**
 * Create all PI agent tools backed by core functions + map protocol.
 *
 * @param ctx - Shared tool context (built once at agent startup, snapshot
 *              updates each tick via the mutable MapContext reference).
 * @param mapCtx - Mutable map context with protocol for map queries.
 * @returns Array of AgentTools ready for the PI agent.
 */
export function createCoreTools(ctx: ToolContext, mapCtx: MapContext): AgentTool<any>[] {
  return [
    // ── Map Protocol Tools ──
    {
      name: "map_tile_info",
      label: "Tile Info",
      description: "What's at this position? Full details: biome, entity, guards, resources, strength.",
      parameters: Type.Object({
        x: Type.Number({ description: "Map X coordinate" }),
        y: Type.Number({ description: "Map Y coordinate" }),
      }),
      async execute(_toolCallId: string, params: any) {
        if (!mapCtx.protocol) return { content: [{ type: "text" as const, text: "Map not loaded yet." }], details: {} };
        const r = await mapCtx.protocol.tileInfo(params.x, params.y);
        return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }], details: r };
      },
    },
    {
      name: "map_nearby",
      label: "Nearby",
      description: "What's around this position? Returns grouped lists: your armies, enemies, structures, chests.",
      parameters: Type.Object({
        x: Type.Number({ description: "Map X coordinate" }),
        y: Type.Number({ description: "Map Y coordinate" }),
        radius: Type.Optional(Type.Number({ description: "Search radius in hexes (default 5)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        if (!mapCtx.protocol) return { content: [{ type: "text" as const, text: "Map not loaded yet." }], details: {} };
        const r = await mapCtx.protocol.nearby(params.x, params.y, params.radius ?? 5);
        return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }], details: r };
      },
    },
    {
      name: "map_entity_info",
      label: "Entity Info",
      description: "Full details on an entity by ID: troops, stamina, guards, resources, strength, owner.",
      parameters: Type.Object({
        entity_id: Type.Number({ description: "Entity ID" }),
      }),
      async execute(_toolCallId: string, params: any) {
        if (!mapCtx.protocol) return { content: [{ type: "text" as const, text: "Map not loaded yet." }], details: {} };
        const r = await mapCtx.protocol.entityInfo(params.entity_id);
        if (!r)
          return { content: [{ type: "text" as const, text: `Entity ${params.entity_id} not found.` }], details: {} };
        return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }], details: r };
      },
    },
    {
      name: "map_find",
      label: "Find Entities",
      description:
        "Find entities by type: hyperstructure, mine, village, chest, enemy_army, enemy_structure, own_army, own_structure.",
      parameters: Type.Object({
        type: Type.String({ description: "Entity type to search for" }),
        ref_x: Type.Optional(Type.Number({ description: "Reference X for distance sorting" })),
        ref_y: Type.Optional(Type.Number({ description: "Reference Y for distance sorting" })),
      }),
      async execute(_toolCallId: string, params: any) {
        if (!mapCtx.protocol) return { content: [{ type: "text" as const, text: "Map not loaded yet." }], details: {} };
        const ref = params.ref_x != null && params.ref_y != null ? { x: params.ref_x, y: params.ref_y } : undefined;
        const r = await mapCtx.protocol.find(params.type, ref);
        return { content: [{ type: "text" as const, text: JSON.stringify(r, null, 2) }], details: r };
      },
    },
    {
      name: "map_briefing",
      label: "Game Briefing",
      description: "Get the current game state briefing: your armies, structures, threats, opportunities.",
      parameters: Type.Object({}),
      async execute() {
        if (!mapCtx.protocol) return { content: [{ type: "text" as const, text: "Map not loaded yet." }], details: {} };
        const text = mapCtx.protocol.briefing() || "(No owned entities)";
        return { content: [{ type: "text" as const, text }], details: { briefing: text } };
      },
    },

    // ── Movement ──
    {
      name: "move_army",
      label: "Move Army",
      description: "Move one of your armies to a target position. Pathfinds automatically. Explores unexplored tiles.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of your army" }),
        target_x: Type.Number({ description: "Target map X" }),
        target_y: Type.Number({ description: "Target map Y" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await moveArmy(
          { armyId: params.army_id, targetX: params.target_x, targetY: params.target_y },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },

    // ── Combat ──
    {
      name: "simulate_attack",
      label: "Simulate Attack",
      description:
        "Preview a battle outcome WITHOUT executing it. Use before attack_target to decide whether to commit.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of your army" }),
        target_x: Type.Number({ description: "Target map X" }),
        target_y: Type.Number({ description: "Target map Y" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await simulateAttack(
          { armyId: params.army_id, targetX: params.target_x, targetY: params.target_y },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "attack_target",
      label: "Attack Target",
      description:
        "Attack a target adjacent to your army. Reports battle outcome. " +
        "NOTE: Larger armies are disproportionately stronger — always attack with your biggest army.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of your army" }),
        target_x: Type.Number({ description: "Target map X" }),
        target_y: Type.Number({ description: "Target map Y" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await attackTarget(
          { armyId: params.army_id, targetX: params.target_x, targetY: params.target_y },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "attack_from_guard",
      label: "Attack From Guard",
      description: "Attack an adjacent enemy army using your structure's guards.",
      parameters: Type.Object({
        structure_id: Type.Number({ description: "Entity ID of your structure" }),
        slot: Type.Number({ description: "Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)" }),
        target_army_id: Type.Number({ description: "Entity ID of the enemy army" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await attackFromGuard(
          { structureId: params.structure_id, slot: params.slot, targetArmyId: params.target_army_id },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "raid_target",
      label: "Raid Target",
      description: "Raid an adjacent structure for resources. Deals 10% of normal battle damage.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of your raiding army" }),
        target_x: Type.Number({ description: "Target structure map X" }),
        target_y: Type.Number({ description: "Target structure map Y" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await raidTarget(
          { armyId: params.army_id, targetX: params.target_x, targetY: params.target_y },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },

    // ── Army Management ──
    {
      name: "create_army",
      label: "Create Army",
      description:
        "Create a new army at one of your realms. Auto-selects troop type by biome. " +
        "NOTE: Larger armies are disproportionately stronger — prefer fewer, bigger armies.",
      parameters: Type.Object({
        structure_id: Type.Number({ description: "Entity ID of your realm" }),
        troop_type: Type.Optional(Type.String({ description: "Knight, Paladin, or Crossbowman" })),
        tier: Type.Optional(Type.Number({ description: "Troop tier (1-3)" })),
        amount: Type.Optional(Type.Number({ description: "Number of troops (default: all available, max 10000)" })),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await createArmy(
          { structureId: params.structure_id, troopType: params.troop_type, tier: params.tier, amount: params.amount },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "reinforce_army",
      label: "Reinforce Army",
      description: "Add more troops from the home structure's storage to an existing army.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of the army to reinforce" }),
        amount: Type.Number({ description: "Number of troops to add" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await reinforceArmy({ armyId: params.army_id, amount: params.amount }, ctx);
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "open_chest",
      label: "Open Chest",
      description: "Open a chest adjacent to your army for relics and victory points.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of your army" }),
        chest_x: Type.Number({ description: "Chest map X" }),
        chest_y: Type.Number({ description: "Chest map Y" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await openChest({ armyId: params.army_id, chestX: params.chest_x, chestY: params.chest_y }, ctx);
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },

    // ── Guard & Troop Transfer ──
    {
      name: "guard_from_storage",
      label: "Guard From Storage",
      description:
        "Add troops from a structure's storage to a guard slot. " +
        "NOTE: Larger groups in one slot are disproportionately stronger.",
      parameters: Type.Object({
        structure_id: Type.Number({ description: "Entity ID of the structure" }),
        slot: Type.Number({ description: "Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)" }),
        troop_type: Type.String({ description: "Knight, Paladin, or Crossbowman" }),
        tier: Type.Number({ description: "Troop tier (1-3)" }),
        amount: Type.Number({ description: "Number of troops" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await guardFromStorage(
          {
            structureId: params.structure_id,
            slot: params.slot,
            troopType: params.troop_type,
            tier: params.tier,
            amount: params.amount,
          },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "guard_from_army",
      label: "Guard From Army",
      description:
        "Move troops from an adjacent army into a structure's guard slot. " +
        "NOTE: Larger groups in one slot are disproportionately stronger.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Entity ID of the army" }),
        structure_id: Type.Number({ description: "Entity ID of the structure" }),
        slot: Type.Number({ description: "Guard slot (0-3)" }),
        amount: Type.Number({ description: "Number of troops" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await guardFromArmy(
          { armyId: params.army_id, structureId: params.structure_id, slot: params.slot, amount: params.amount },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "unguard_to_army",
      label: "Unguard To Army",
      description: "Move troops from a guard slot to an adjacent army.",
      parameters: Type.Object({
        structure_id: Type.Number({ description: "Entity ID of the structure" }),
        slot: Type.Number({ description: "Guard slot (0-3)" }),
        army_id: Type.Number({ description: "Entity ID of the receiving army" }),
        amount: Type.Number({ description: "Number of troops" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await unguardToArmy(
          { structureId: params.structure_id, slot: params.slot, armyId: params.army_id, amount: params.amount },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "transfer_troops",
      label: "Transfer Troops",
      description:
        "Transfer troops between two adjacent armies (same type/tier). " +
        "NOTE: Larger armies are disproportionately stronger — use this to consolidate.",
      parameters: Type.Object({
        from_army_id: Type.Number({ description: "Army giving troops" }),
        to_army_id: Type.Number({ description: "Army receiving troops" }),
        amount: Type.Number({ description: "Number of troops" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await transferTroops(
          { fromArmyId: params.from_army_id, toArmyId: params.to_army_id, amount: params.amount },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },

    // ── Resource Transfer ──
    {
      name: "send_resources",
      label: "Send Resources",
      description:
        "Transfer resources between structures via donkey caravan. Auto-picks send vs pickup based on donkey availability.",
      parameters: Type.Object({
        from_structure_id: Type.Number({ description: "Source structure entity ID" }),
        to_structure_id: Type.Number({ description: "Destination structure entity ID" }),
        resources: Type.Array(
          Type.Object({
            resource_id: Type.Number({ description: "Resource type ID" }),
            amount: Type.Number({ description: "Amount (human-readable)" }),
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await sendResources(
          {
            fromStructureId: params.from_structure_id,
            toStructureId: params.to_structure_id,
            resources: params.resources.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })),
          },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "transfer_to_structure",
      label: "Transfer To Structure",
      description: "Transfer resources from an army to an adjacent structure.",
      parameters: Type.Object({
        army_id: Type.Number({ description: "Army carrying resources" }),
        structure_id: Type.Number({ description: "Receiving structure" }),
        resources: Type.Array(
          Type.Object({
            resource_id: Type.Number({ description: "Resource type ID" }),
            amount: Type.Number({ description: "Amount (human-readable)" }),
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await transferToStructure(
          {
            armyId: params.army_id,
            structureId: params.structure_id,
            resources: params.resources.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })),
          },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
    {
      name: "transfer_to_army",
      label: "Transfer To Army",
      description: "Transfer resources between two adjacent armies.",
      parameters: Type.Object({
        from_army_id: Type.Number({ description: "Army giving resources" }),
        to_army_id: Type.Number({ description: "Army receiving resources" }),
        resources: Type.Array(
          Type.Object({
            resource_id: Type.Number({ description: "Resource type ID" }),
            amount: Type.Number({ description: "Amount (human-readable)" }),
          }),
        ),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await transferToArmy(
          {
            fromArmyId: params.from_army_id,
            toArmyId: params.to_army_id,
            resources: params.resources.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })),
          },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },

    // ── Buffs ──
    {
      name: "apply_relic",
      label: "Apply Relic",
      description: "Apply a relic buff to an army, structure guards, or structure production. Costs Essence.",
      parameters: Type.Object({
        entity_id: Type.Number({ description: "Entity ID to buff" }),
        relic_resource_id: Type.Number({ description: "Relic resource ID" }),
        recipient_type: Type.Number({ description: "0=Explorer, 1=StructureGuard, 2=StructureProduction" }),
      }),
      async execute(_toolCallId: string, params: any) {
        const result = await applyRelic(
          {
            entityId: params.entity_id,
            relicResourceId: params.relic_resource_id,
            recipientType: params.recipient_type,
          },
          ctx,
        );
        return { content: [{ type: "text" as const, text: result.message }], details: result };
      },
    },
  ];
}
