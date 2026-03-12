/**
 * set_guards — assign troops from a structure's reserves to a guard slot.
 *
 * The agent points at an owned structure (realm, village, mine, etc.)
 * and specifies troop type, tier, and optionally amount. The tool finds
 * the first available guard slot and fills it.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";

// On-chain troop category
const TROOP_CATEGORY: Record<string, number> = {
  Knight: 0,
  Paladin: 1,
  Crossbowman: 2,
};

// On-chain tier values
const TIER_VALUE: Record<number, number> = { 1: 0, 2: 1, 3: 2 };
const TIER_SUFFIX: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

// Guard slot names (index = on-chain slot number)
const SLOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta"];

// Max troops per guard assignment
const TARGET_TROOP_AMOUNT = 10_000 * RESOURCE_PRECISION;

export function createSetGuardsTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "set_guards",
    label: "Set Guards",
    description:
      "Assign troops to defend one of your structures (realm, village, mine, hyperstructure). " +
      "Specify the structure position, troop type (Knight, Paladin, Crossbowman), and tier (1, 2, or 3). " +
      "Uses troops from the structure's reserves. Fills the first available guard slot. " +
      "Each structure has up to 4 guard slots (Alpha, Bravo, Charlie, Delta).",
    parameters: Type.Object({
      row: Type.Number({ description: "Line number of your structure on the map" }),
      col: Type.Number({ description: "Column of your structure on the map" }),
      troop_type: Type.Union([Type.Literal("Knight"), Type.Literal("Paladin"), Type.Literal("Crossbowman")], {
        description: "Troop type to assign as guards",
      }),
      tier: Type.Optional(
        Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)], {
          description: "Troop tier (1, 2, or 3). Defaults to 1.",
        }),
      ),
      amount: Type.Optional(
        Type.Number({ description: "Number of troops to assign (default: all available, up to 10K)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col, troop_type } = params;
      const tier = params.tier ?? 1;

      if (signal?.aborted) throw new Error("Operation cancelled");

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      const hexCoords = mapCtx.snapshot.resolve(row, col);
      if (!hexCoords) {
        throw new Error(
          `Invalid position ${row}:${col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
        );
      }

      // ── Fetch structure ──

      const { x, y } = hexCoords;
      const structure = await client.view.structureAt(x, y);

      if (!structure) {
        throw new Error(`No structure at ${row}:${col}.`);
      }

      if (playerAddress && !addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure at ${row}:${col} is not yours (owner: ${structure.ownerAddress}).`);
      }

      // ── Find available guard slot ──

      const occupiedSlots = new Set(structure.guards.map((g) => g.slot));
      let slotIndex: number | null = null;
      for (let i = 0; i < SLOT_NAMES.length; i++) {
        if (!occupiedSlots.has(SLOT_NAMES[i])) {
          slotIndex = i;
          break;
        }
      }

      if (slotIndex === null) {
        const guardSummary = structure.guards
          .map((g) => `${g.slot}: ${g.count.toLocaleString()} ${g.troopType} ${g.troopTier}`)
          .join(", ");
        throw new Error(`All guard slots are full. Current guards: ${guardSummary}`);
      }

      // ── Check available troops ──

      const category = TROOP_CATEGORY[troop_type];
      if (category === undefined) {
        throw new Error(`Unknown troop type: ${troop_type}. Use Knight, Paladin, or Crossbowman.`);
      }

      const tierSuffix = TIER_SUFFIX[tier] ?? "T1";
      const troopResName = `${troop_type} ${tierSuffix}`;
      const availableDisplay = structure.resources.find((r) => r.name === troopResName)?.amount ?? 0;
      const availableRaw = availableDisplay > 0 ? Math.floor(availableDisplay * RESOURCE_PRECISION) : 0;

      if (availableRaw <= 0) {
        const resSummary = structure.resources.map((r) => `${r.amount.toLocaleString()} ${r.name}`).join(", ");
        throw new Error(`No ${troopResName} available at this structure. Available: ${resSummary || "none"}`);
      }

      const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : TARGET_TROOP_AMOUNT;
      const troopAmount = Math.min(requestedRaw, availableRaw);
      const troopCount = Math.floor(troopAmount / RESOURCE_PRECISION);
      const troopTier = TIER_VALUE[tier] ?? 0;

      // ── Execute ──

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
        throw new Error(`Set guards failed: ${extractTxError(err)}`);
      }

      const slotName = SLOT_NAMES[slotIndex];
      const remainingDisplay = availableDisplay - troopCount;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Assigned ${troopCount.toLocaleString()} ${troopResName} to guard slot ${slotName} at ${row}:${col}`,
              `Structure: ${structure.category}`,
              `Remaining ${troopResName}: ~${Math.max(0, remainingDisplay).toLocaleString()}`,
            ].join("\n"),
          },
        ],
        details: {
          structureId: structure.entityId,
          slot: slotIndex,
          slotName,
          troopType: troop_type,
          troopTier: tierSuffix,
          troopCount,
        },
      };
    },
  };
}
