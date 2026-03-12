/**
 * garrison — transfer troops from a field army to a guard slot on an adjacent structure.
 *
 * Use after capturing a structure to immediately defend it with your army's troops.
 * The army must be adjacent to the structure. Troops are moved from the army
 * into the first available guard slot.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getDirectionBetweenAdjacentHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isStructure } from "../world/occupier.js";

const SLOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta"];

export function createGarrisonTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "garrison",
    label: "Garrison Structure",
    description:
      "Transfer troops from one of your field armies into a guard slot on an adjacent structure. " +
      "Use after capturing a hyperstructure, mine, or village to immediately defend it. " +
      "The army must be 1 hex away from the structure. Troops move from the army into the first empty guard slot. " +
      "Specify how many troops to transfer (default: all).",
    parameters: Type.Object({
      army_row: Type.Number({ description: "Line number of your army on the map" }),
      army_col: Type.Number({ description: "Column of your army on the map" }),
      structure_row: Type.Number({ description: "Line number of the structure to garrison" }),
      structure_col: Type.Number({ description: "Column of the structure to garrison" }),
      amount: Type.Optional(
        Type.Number({ description: "Number of troops to transfer (default: all troops in army)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { army_row, army_col, structure_row, structure_col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      // ── Resolve positions ──

      const armyHex = mapCtx.snapshot.resolve(army_row, army_col);
      const structHex = mapCtx.snapshot.resolve(structure_row, structure_col);
      if (!armyHex) throw new Error(`Invalid army position ${army_row}:${army_col}.`);
      if (!structHex) throw new Error(`Invalid structure position ${structure_row}:${structure_col}.`);

      // ── Validate army ──

      const armyTile = mapCtx.snapshot.tileAt(army_row, army_col);
      if (!armyTile || !isExplorer(armyTile.occupierType)) {
        throw new Error(`No army at ${army_row}:${army_col}. Point at one of your armies.`);
      }

      const explorer = await client.view.explorerInfo(armyTile.occupierId);
      if (!explorer) throw new Error(`Explorer ${armyTile.occupierId} not found.`);

      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Army at ${army_row}:${army_col} is not yours.`);
      }

      // ── Validate structure ──

      const structTile = mapCtx.snapshot.tileAt(structure_row, structure_col);
      if (!structTile || !isStructure(structTile.occupierType)) {
        throw new Error(`No structure at ${structure_row}:${structure_col}.`);
      }

      const structure = await client.view.structureAt(structHex.x, structHex.y);
      if (!structure) throw new Error(`Structure at ${structure_row}:${structure_col} not found.`);

      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure at ${structure_row}:${structure_col} is not yours (owner: ${structure.ownerAddress}).`);
      }

      // ── Check adjacency ──

      const direction = getDirectionBetweenAdjacentHexes(
        { col: armyHex.x, row: armyHex.y },
        { col: structHex.x, row: structHex.y },
      );

      if (direction === null) {
        throw new Error(
          `Army at ${army_row}:${army_col} and structure at ${structure_row}:${structure_col} are not adjacent. ` +
            `Move the army next to the structure first.`,
        );
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
        const guardSummary = structure.guards
          .map((g) => `${g.slot}: ${g.count.toLocaleString()} ${g.troopType} ${g.troopTier}`)
          .join(", ");
        throw new Error(`All guard slots are full. Current guards: ${guardSummary}`);
      }

      // ── Compute amount ──

      const availableRaw = Math.floor(explorer.troopCount * RESOURCE_PRECISION);
      const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : availableRaw;
      const transferAmount = Math.min(requestedRaw, availableRaw);
      const transferCount = Math.floor(transferAmount / RESOURCE_PRECISION);

      if (transferAmount <= 0) {
        throw new Error(`Army at ${army_row}:${army_col} has no troops to transfer.`);
      }

      // ── Execute ──

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
        throw new Error(`Garrison failed: ${extractTxError(err)}`);
      }

      const slotName = SLOT_NAMES[slotIndex];
      const remaining = explorer.troopCount - transferCount;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Garrisoned ${transferCount.toLocaleString()} ${explorer.troopType} ${explorer.troopTier} into ${structure.category} at ${structure_row}:${structure_col} (slot ${slotName})`,
              `Army remaining: ${Math.max(0, remaining).toLocaleString()} troops`,
              remaining <= 0 ? `Army is now empty — consider deleting it to free the slot.` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        details: {
          explorerId: explorer.entityId,
          structureId: structure.entityId,
          slot: slotIndex,
          slotName,
          transferred: transferCount,
          remaining: Math.max(0, remaining),
        },
      };
    },
  };
}
