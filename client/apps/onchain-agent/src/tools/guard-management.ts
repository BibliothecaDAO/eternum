/**
 * Guard management tools — guard_delete, guard_explorer_swap, attack_guard_vs_explorer.
 *
 * guard_delete: Remove troops from a guard slot on your structure.
 * guard_explorer_swap: Move troops from a guard slot to an adjacent explorer.
 * attack_guard_vs_explorer: Use a guard to attack an adjacent enemy explorer.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getDirectionBetweenAdjacentHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isStructure } from "../world/occupier.js";

/** Ordered guard slot names matching on-chain slot indices 0–3. */
const SLOT_NAMES = ["Alpha", "Bravo", "Charlie", "Delta"];

/**
 * Create the guard_delete tool — remove troops from a guard slot.
 */
export function createGuardDeleteTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "guard_delete",
    label: "Delete Guard",
    description:
      "Remove ALL troops from a guard slot on one of your structures. " +
      "Troops are returned to the structure's reserves. " +
      "Specify the structure position and slot index (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta). " +
      "Use inspect_tile first to see which slots have guards.",
    parameters: Type.Object({
      row: Type.Number({ description: "Row of the structure" }),
      col: Type.Number({ description: "Column of the structure" }),
      slot: Type.Number({ description: "Guard slot index (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col, slot } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");
      if (slot < 0 || slot > 3) throw new Error("Slot must be 0–3 (Alpha, Bravo, Charlie, Delta).");

      const hex = mapCtx.snapshot.resolve(row, col);
      if (!hex) throw new Error(`Invalid position ${row}:${col}.`);

      const tile = mapCtx.snapshot.tileAt(row, col);
      if (!tile || !isStructure(tile.occupierType)) {
        throw new Error(`No structure at ${row}:${col}.`);
      }

      const structure = await client.view.structureAt(hex.x, hex.y);
      if (!structure) throw new Error(`Structure at ${row}:${col} not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure at ${row}:${col} is not yours.`);
      }

      const guard = structure.guards.find((g) => g.slot === SLOT_NAMES[slot]);
      if (!guard || guard.count <= 0) {
        const occupied = structure.guards
          .filter((g) => g.count > 0)
          .map((g) => `${g.slot}: ${g.count.toLocaleString()} ${g.troopType} ${g.troopTier}`)
          .join(", ");
        throw new Error(`Guard slot ${SLOT_NAMES[slot]} is empty. Occupied: ${occupied || "none"}`);
      }

      try {
        await tx.provider.guard_delete({
          for_structure_id: structure.entityId,
          slot,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Guard delete failed (${SLOT_NAMES[slot]} at ${structure.category}): ${extractTxError(err)}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Removed ${guard.count.toLocaleString()} ${guard.troopType} ${guard.troopTier} from guard slot ${SLOT_NAMES[slot]}. Troops returned to reserves.`,
          },
        ],
        details: {
          structureId: structure.entityId,
          slot: SLOT_NAMES[slot],
          troopsRemoved: guard.count,
          troopType: guard.troopType,
          troopTier: guard.troopTier,
        },
      };
    },
  };
}

/**
 * Create the guard_explorer_swap tool — move troops from a guard slot to an adjacent explorer.
 */
export function createGuardExplorerSwapTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "guard_explorer_swap",
    label: "Guard to Explorer",
    description:
      "Move troops from a guard slot on your structure to an adjacent explorer (army). " +
      "The explorer must be adjacent to the structure. " +
      "Specify the structure, guard slot, and the explorer position. " +
      "Use this to reinforce an army from a structure's garrison.",
    parameters: Type.Object({
      structure_row: Type.Number({ description: "Row of the structure with guards" }),
      structure_col: Type.Number({ description: "Column of the structure" }),
      guard_slot: Type.Number({ description: "Guard slot index (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)" }),
      explorer_row: Type.Number({ description: "Row of the explorer to receive troops" }),
      explorer_col: Type.Number({ description: "Column of the explorer" }),
      amount: Type.Optional(Type.Number({ description: "Number of troops to transfer (default: all in guard slot)" })),
    }),
    async execute(_toolCallId, params, signal) {
      const { structure_row, structure_col, guard_slot, explorer_row, explorer_col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");
      if (guard_slot < 0 || guard_slot > 3) throw new Error("guard_slot must be 0–3.");

      const structHex = mapCtx.snapshot.resolve(structure_row, structure_col);
      if (!structHex) throw new Error(`Invalid structure position ${structure_row}:${structure_col}.`);

      const explorerHex = mapCtx.snapshot.resolve(explorer_row, explorer_col);
      if (!explorerHex) throw new Error(`Invalid explorer position ${explorer_row}:${explorer_col}.`);

      // Validate structure
      const structTile = mapCtx.snapshot.tileAt(structure_row, structure_col);
      if (!structTile || !isStructure(structTile.occupierType)) {
        throw new Error(`No structure at ${structure_row}:${structure_col}.`);
      }
      const structure = await client.view.structureAt(structHex.x, structHex.y);
      if (!structure) throw new Error(`Structure not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure is not yours.`);
      }

      // Validate guard slot
      const guard = structure.guards.find((g) => g.slot === SLOT_NAMES[guard_slot]);
      if (!guard || guard.count <= 0) {
        throw new Error(`Guard slot ${SLOT_NAMES[guard_slot]} is empty.`);
      }

      // Validate explorer
      const explorerTile = mapCtx.snapshot.tileAt(explorer_row, explorer_col);
      if (!explorerTile || !isExplorer(explorerTile.occupierType)) {
        throw new Error(`No explorer at ${explorer_row}:${explorer_col}.`);
      }
      const explorer = await client.view.explorerInfo(explorerTile.occupierId);
      if (!explorer) throw new Error(`Explorer not found.`);
      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Explorer is not yours.`);
      }

      // Check adjacency
      const direction = getDirectionBetweenAdjacentHexes(
        { col: structHex.x, row: structHex.y },
        { col: explorerHex.x, row: explorerHex.y },
      );
      if (direction === null) {
        throw new Error(`Structure and explorer are not adjacent.`);
      }

      const guardRaw = Math.floor(guard.count * RESOURCE_PRECISION);
      const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : guardRaw;
      const transferAmount = Math.min(requestedRaw, guardRaw);
      const transferCount = Math.floor(transferAmount / RESOURCE_PRECISION);

      try {
        await tx.provider.guard_explorer_swap({
          from_structure_id: structure.entityId,
          from_guard_slot: guard_slot,
          to_explorer_id: explorer.entityId,
          to_explorer_direction: direction,
          count: transferAmount,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Guard→explorer swap failed: ${extractTxError(err)}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Transferred ${transferCount.toLocaleString()} ${guard.troopType} ${guard.troopTier} from guard slot ${SLOT_NAMES[guard_slot]} to explorer at ${explorer_row}:${explorer_col}.`,
          },
        ],
        details: {
          structureId: structure.entityId,
          explorerId: explorer.entityId,
          slot: SLOT_NAMES[guard_slot],
          transferred: transferCount,
        },
      };
    },
  };
}

/**
 * Create the attack_guard_vs_explorer tool — use a guard to attack an adjacent enemy explorer.
 */
export function createAttackGuardVsExplorerTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "attack_guard_vs_explorer",
    label: "Guard Attack Explorer",
    description:
      "Use a guard from one of your structures to attack an adjacent enemy explorer (army). " +
      "This is a defensive action — the guard attacks without leaving the structure. " +
      "Specify your structure position, which guard slot to use, and the enemy explorer position. " +
      "The explorer must be adjacent to the structure.",
    parameters: Type.Object({
      structure_row: Type.Number({ description: "Row of your structure" }),
      structure_col: Type.Number({ description: "Column of your structure" }),
      guard_slot: Type.Number({ description: "Guard slot to attack with (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)" }),
      explorer_row: Type.Number({ description: "Row of the enemy explorer" }),
      explorer_col: Type.Number({ description: "Column of the enemy explorer" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { structure_row, structure_col, guard_slot, explorer_row, explorer_col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");
      if (guard_slot < 0 || guard_slot > 3) throw new Error("guard_slot must be 0–3.");

      const structHex = mapCtx.snapshot.resolve(structure_row, structure_col);
      if (!structHex) throw new Error(`Invalid structure position ${structure_row}:${structure_col}.`);

      const explorerHex = mapCtx.snapshot.resolve(explorer_row, explorer_col);
      if (!explorerHex) throw new Error(`Invalid explorer position ${explorer_row}:${explorer_col}.`);

      // Validate structure
      const structTile = mapCtx.snapshot.tileAt(structure_row, structure_col);
      if (!structTile || !isStructure(structTile.occupierType)) {
        throw new Error(`No structure at ${structure_row}:${structure_col}.`);
      }
      const structure = await client.view.structureAt(structHex.x, structHex.y);
      if (!structure) throw new Error(`Structure not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure is not yours.`);
      }

      // Validate guard slot has troops
      const guard = structure.guards.find((g) => g.slot === SLOT_NAMES[guard_slot]);
      if (!guard || guard.count <= 0) {
        throw new Error(`Guard slot ${SLOT_NAMES[guard_slot]} is empty. Cannot attack.`);
      }

      // Validate enemy explorer
      const explorerTile = mapCtx.snapshot.tileAt(explorer_row, explorer_col);
      if (!explorerTile || !isExplorer(explorerTile.occupierType)) {
        throw new Error(`No explorer at ${explorer_row}:${explorer_col}.`);
      }
      const explorer = await client.view.explorerInfo(explorerTile.occupierId);
      if (!explorer) throw new Error(`Explorer not found.`);
      if (addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`That explorer is yours! Use guard_explorer_swap instead to transfer troops.`);
      }

      // Check adjacency
      const direction = getDirectionBetweenAdjacentHexes(
        { col: structHex.x, row: structHex.y },
        { col: explorerHex.x, row: explorerHex.y },
      );
      if (direction === null) {
        throw new Error(`Structure and explorer are not adjacent. Enemy must be next to your structure.`);
      }

      try {
        await tx.provider.attack_guard_vs_explorer({
          structure_id: structure.entityId,
          structure_guard_slot: guard_slot,
          explorer_id: explorer.entityId,
          explorer_direction: direction,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Guard attack failed: ${extractTxError(err)}`);
      }

      // Re-inspect to determine outcome
      const afterGuard = structure.guards.find((g) => g.slot === SLOT_NAMES[guard_slot]);
      const afterExplorer = await client.view.explorerInfo(explorer.entityId);
      const explorerSurvived = afterExplorer && afterExplorer.troopCount > 0;

      // Re-fetch structure to get updated guard status
      const afterStructure = await client.view.structureAt(structHex.x, structHex.y);
      const updatedGuard = afterStructure?.guards.find((g) => g.slot === SLOT_NAMES[guard_slot]);
      const guardSurvived = updatedGuard && updatedGuard.count > 0;

      let outcome: string;
      if (guardSurvived && !explorerSurvived) {
        outcome = `VICTORY — enemy explorer destroyed. Guard has ${updatedGuard!.count.toLocaleString()} troops remaining.`;
      } else if (!guardSurvived && explorerSurvived) {
        outcome = `DEFEAT — guard destroyed. Enemy has ${afterExplorer!.troopCount.toLocaleString()} troops remaining.`;
      } else if (guardSurvived && explorerSurvived) {
        outcome = `DRAW — both survived. Guard: ${updatedGuard!.count.toLocaleString()}, Enemy: ${afterExplorer!.troopCount.toLocaleString()}.`;
      } else {
        outcome = `Both destroyed.`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Guard ${SLOT_NAMES[guard_slot]} (${guard.troopType} ${guard.troopTier}) attacked enemy explorer`,
              outcome,
            ].join("\n"),
          },
        ],
        details: {
          structureId: structure.entityId,
          explorerId: explorer.entityId,
          guardSlot: SLOT_NAMES[guard_slot],
          outcome,
        },
      };
    },
  };
}
