/**
 * `defend_structure` tool — assign guard troops to one of your structures.
 *
 * Two modes (auto-detected):
 *   - `from_army_id` provided → transfer troops from an adjacent army (`explorer_guard_swap`)
 *   - Omitted → draw troops from the structure's own reserves (`guard_add`)
 *
 * Fills the first available guard slot (up to 4: Alpha, Bravo, Charlie, Delta).
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getDirectionBetweenAdjacentHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isStructure } from "../world/occupier.js";

/** Maps troop names to their on-chain category index (Knight=0, Paladin=1, Crossbowman=2). */
const TROOP_CATEGORY: Record<string, number> = { Knight: 0, Paladin: 1, Crossbowman: 2 };

/** Maps user-facing tier numbers (1/2/3) to on-chain tier values (0/1/2). */
const TIER_VALUE: Record<number, number> = { 1: 0, 2: 1, 3: 2 };

/** Maps tier numbers to the resource name suffix in structure resource lists (e.g. "T1"). */
const TIER_SUFFIX: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

/** Ordered guard slot names matching on-chain slot indices 0–3. */
const SLOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta"];

/**
 * Maximum T1 troop count per guard slot, keyed by structure level.
 * Formula: deploymentCap * t1_modifier / (t1_strength * 100).
 */
const GUARD_CAP_BY_LEVEL: Record<number, number> = {
  0: 1_500, // Settlement
  1: 7_500, // City
  2: 22_500, // Kingdom
  3: 45_000, // Empire
};

/**
 * Create the defend_structure agent tool.
 *
 * @param client - Eternum client for fetching structure and explorer data.
 * @param mapCtx - Map context holding the current tile snapshot.
 * @param playerAddress - Hex address of the player; used to verify structure and army ownership.
 * @param tx - Transaction context with the provider and signer.
 * @returns An AgentTool that assigns guard troops to a structure slot from an adjacent army or the structure's own reserves.
 */
export function createDefendStructureTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "defend_structure",
    label: "Defend Structure",
    description:
      "Assign guard troops to defend one of your structures (realm, village, mine, hyperstructure). " +
      "Two modes: " +
      "(1) Specify from_army_id to transfer troops from an adjacent field army — " +
      "use this right after capturing a structure to garrison it. " +
      "(2) Omit from_army to use troops from the structure's own reserves — " +
      "requires troop_type and tier since the structure may have multiple troop types. " +
      "Fills the first empty guard slot (up to 4: Alpha, Bravo, Charlie, Delta). " +
      "Guard slot capacity scales with structure level: ~1,500 (lv0), ~7,500 (lv1), ~22,500 (lv2), ~45,000 (lv3). " +
      "Defaults to max capacity for the structure's level.",
    parameters: Type.Object({
      structure_id: Type.Number({ description: "Entity ID of the structure to defend (from briefing or map_query)" }),
      from_army_id: Type.Optional(
        Type.Number({ description: "Entity ID of your army to transfer troops from (must be adjacent)" }),
      ),
      troop_type: Type.Optional(
        Type.Union([Type.Literal("Knight"), Type.Literal("Paladin"), Type.Literal("Crossbowman")], {
          description: "Troop type (required when using reserves, auto-detected from army)",
        }),
      ),
      tier: Type.Optional(
        Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)], {
          description: "Troop tier 1/2/3 (required when using reserves, auto-detected from army). Defaults to 1.",
        }),
      ),
      amount: Type.Optional(
        Type.Number({ description: "Number of troops to assign (default: all from army, up to 10K from reserves)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { structure_id: structureId } = params;
      const useArmy = params.from_army_id != null;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      // ── Find structure tile by entity ID ──

      let structTile = null as any;
      for (const t of mapCtx.snapshot.tiles) {
        if (t.occupierId === structureId) { structTile = t; break; }
      }
      if (!structTile || !isStructure(structTile.occupierType)) {
        throw new Error(`No structure with ID ${structureId} found.`);
      }

      const structHex = structTile.position;
      const structure = await client.view.structureAt(structHex.x, structHex.y);
      if (!structure) throw new Error(`Structure ${structureId} not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure ${structureId} is not yours.`);
      }

      // ── Find empty guard slot ──

      const occupiedSlots = new Set(structure.guards.map((g) => g.slot));
      let slotIndex: number | null = null;
      for (let i = 0; i < SLOT_NAMES.length; i++) {
        if (!occupiedSlots.has(SLOT_NAMES[i])) {
          slotIndex = i;
          break;
        }
      }
      if (slotIndex === null) {
        const summary = structure.guards
          .map((g) => `${g.slot}: ${g.count.toLocaleString()} ${g.troopType} ${g.troopTier}`)
          .join(", ");
        throw new Error(`All 4 guard slots are full. Current guards: ${summary}`);
      }
      const slotName = SLOT_NAMES[slotIndex];

      // ── Mode 1: Transfer from adjacent army ──

      if (useArmy) {
        const fromArmyId = params.from_army_id!;
        const explorer = await client.view.explorerInfo(fromArmyId);
        if (!explorer) throw new Error(`Army ${fromArmyId} not found.`);
        if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
          throw new Error(`Army ${fromArmyId} is not yours.`);
        }

        const armyHex = explorer.position;

        const direction = getDirectionBetweenAdjacentHexes(
          { col: armyHex.x, row: armyHex.y },
          { col: structHex.x, row: structHex.y },
        );
        if (direction === null) {
          throw new Error(`Army and structure are not adjacent. Move the army next to the structure first.`);
        }

        const totalRaw = Math.floor(explorer.troopCount * RESOURCE_PRECISION);
        // Must leave at least 1 troop in the army
        const maxTransferRaw = totalRaw - RESOURCE_PRECISION;
        if (maxTransferRaw <= 0) {
          throw new Error(
            `Army only has ${explorer.troopCount} troops — need more than 1 to garrison (must leave at least 1).`,
          );
        }
        // Cap at guard slot capacity for this structure level
        const guardCap = (GUARD_CAP_BY_LEVEL[structure.level] ?? 1_500) * RESOURCE_PRECISION;
        const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : guardCap;
        const transferAmount = Math.min(requestedRaw, maxTransferRaw, guardCap);
        const transferCount = Math.floor(transferAmount / RESOURCE_PRECISION);

        try {
          await tx.provider.explorer_guard_swap({
            from_explorer_id: explorer.entityId,
            to_structure_id: structure.entityId,
            to_structure_direction: direction,
            to_guard_slot: slotIndex,
            count: transferAmount,
            signer: tx.signer,
          });
        } catch (err: any) {
          throw new Error(
            `Defend failed (${transferCount} ${explorer.troopType} ${explorer.troopTier} → ${structure.category} slot ${slotName}): ${extractTxError(err)}`,
          );
        }

        const remaining = explorer.troopCount - transferCount;
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Garrisoned ${transferCount.toLocaleString()} ${explorer.troopType} ${explorer.troopTier} into ${structure.category} slot ${slotName}`,
                `Army remaining: ${Math.max(0, remaining).toLocaleString()} troops`,
                remaining <= 0 ? "Army is now empty." : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
          details: { mode: "army", slot: slotName, transferred: transferCount, armyRemaining: Math.max(0, remaining) },
        };
      }

      // ── Mode 2: Use structure reserves ──

      const troopType = params.troop_type;
      const tier = params.tier ?? 1;

      if (!troopType) {
        const available = structure.resources
          .filter((r) => /Knight|Paladin|Crossbowman/.test(r.name) && r.amount > 0)
          .map((r) => `${r.amount.toLocaleString()} ${r.name}`)
          .join(", ");
        throw new Error(
          `troop_type is required when defending from reserves (no from_army specified). ` +
            `Available: ${available || "none"}`,
        );
      }

      const category = TROOP_CATEGORY[troopType];
      if (category === undefined) throw new Error(`Unknown troop type: ${troopType}.`);

      const tierSuffix = TIER_SUFFIX[tier] ?? "T1";
      const troopResName = `${troopType} ${tierSuffix}`;
      const availableDisplay = structure.resources.find((r) => r.name === troopResName)?.amount ?? 0;
      const availableRaw = availableDisplay > 0 ? Math.floor(availableDisplay * RESOURCE_PRECISION) : 0;

      if (availableRaw <= 0) {
        const resSummary = structure.resources
          .filter((r) => /Knight|Paladin|Crossbowman/.test(r.name) && r.amount > 0)
          .map((r) => `${r.amount.toLocaleString()} ${r.name}`)
          .join(", ");
        throw new Error(`No ${troopResName} at this structure. Available: ${resSummary || "none"}`);
      }

      const guardCap = (GUARD_CAP_BY_LEVEL[structure.level] ?? 1_500) * RESOURCE_PRECISION;
      const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : guardCap;
      const troopAmount = Math.min(requestedRaw, availableRaw, guardCap);
      const troopCount = Math.floor(troopAmount / RESOURCE_PRECISION);
      const troopTier = TIER_VALUE[tier] ?? 0;

      try {
        await tx.provider.guard_add({
          for_structure_id: structure.entityId,
          slot: slotIndex,
          category,
          tier: troopTier,
          amount: troopAmount,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(
          `Defend failed (${troopCount} ${troopResName} from reserves → slot ${slotName}): ${extractTxError(err)}`,
        );
      }

      const remainingDisplay = availableDisplay - troopCount;
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Assigned ${troopCount.toLocaleString()} ${troopResName} to guard slot ${slotName}`,
              `Structure: ${structure.category} ${structureId} at (${structHex.x},${structHex.y})`,
              `Remaining ${troopResName}: ~${Math.max(0, remainingDisplay).toLocaleString()}`,
            ].join("\n"),
          },
        ],
        details: { mode: "reserves", slot: slotName, troopType, tier: tierSuffix, assigned: troopCount },
      };
    },
  };
}
