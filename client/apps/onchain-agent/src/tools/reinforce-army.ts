/**
 * reinforce_army — add troops to an existing army from an adjacent source.
 *
 * Automatically detects the source:
 *   - Adjacent owned structure → transfers troops from reserves (explorer_add)
 *   - Adjacent owned army (same type/tier) → merges armies (explorer_explorer_swap + explorer_delete)
 *
 * Prefers structures over armies. If merging, the source army is deleted to free its slot.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getNeighborHexes, getDirectionBetweenAdjacentHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isStructure } from "../world/occupier.js";

const TARGET_TROOP_AMOUNT = 10_000 * RESOURCE_PRECISION;
const TIER_SUFFIX: Record<string, string> = { T1: "T1", T2: "T2", T3: "T3" };

export function createReinforceArmyTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "reinforce_army",
    label: "Reinforce Army",
    description:
      "Add troops to one of your armies from a nearby source. " +
      "The tool automatically finds the best adjacent source: " +
      "an owned structure (transfers matching troops from reserves) or " +
      "an owned army of the same type/tier (merges them, freeing the source's army slot). " +
      "Structures are preferred over army merges. " +
      "Specify optional amount (default: all available, up to 10K from structures, all from army merges).",
    parameters: Type.Object({
      row: Type.Number({ description: "Row of the army to reinforce" }),
      col: Type.Number({ description: "Column of the army to reinforce" }),
      amount: Type.Optional(
        Type.Number({ description: "Troops to add (default: all available, up to 10K from structures)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      const hexCoords = mapCtx.snapshot.resolve(row, col);
      if (!hexCoords) throw new Error(`Invalid position ${row}:${col}.`);

      // ── Find the target army ──

      const tile = mapCtx.snapshot.tileAt(row, col);
      if (!tile || !isExplorer(tile.occupierType)) {
        throw new Error(`No army at ${row}:${col}. Point at one of your armies.`);
      }

      const explorer = await client.view.explorerInfo(tile.occupierId);
      if (!explorer) throw new Error(`Explorer ${tile.occupierId} not found.`);
      if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Army at ${row}:${col} is not yours.`);
      }

      const { x, y } = hexCoords;
      const neighbors = getNeighborHexes(x, y);
      const troopType = explorer.troopType;
      const troopTier = explorer.troopTier;
      const tierSuffix = TIER_SUFFIX[troopTier] ?? "T1";
      const troopResName = `${troopType} ${tierSuffix}`;

      // ── Try to find an adjacent owned structure with matching troops ──

      for (const n of neighbors) {
        const nTile = mapCtx.snapshot.gridIndex.get(`${n.col},${n.row}`);
        if (!nTile || !isStructure(nTile.occupierType)) continue;

        const structure = await client.view.structureAt(n.col, n.row);
        if (!structure || !addressesEqual(structure.ownerAddress, playerAddress)) continue;

        const availableDisplay = structure.resources.find((r) => r.name === troopResName)?.amount ?? 0;
        const availableRaw = availableDisplay > 0 ? Math.floor(availableDisplay * RESOURCE_PRECISION) : 0;
        if (availableRaw <= 0) continue;

        // Found a structure with troops — use explorer_add
        const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : TARGET_TROOP_AMOUNT;
        const troopAmount = Math.min(requestedRaw, availableRaw);
        const troopCount = Math.floor(troopAmount / RESOURCE_PRECISION);

        const homeDirection = getDirectionBetweenAdjacentHexes(
          { col: x, row: y },
          { col: n.col, row: n.row },
        );
        if (homeDirection === null) continue;

        try {
          await tx.provider.explorer_add({
            to_explorer_id: explorer.entityId,
            amount: troopAmount,
            home_direction: homeDirection,
            signer: tx.signer,
          });
        } catch (err: any) {
          throw new Error(`Reinforce failed (${troopCount} ${troopResName} from structure): ${extractTxError(err)}`);
        }

        const newTotal = explorer.troopCount + troopCount;
        const remaining = availableDisplay - troopCount;

        return {
          content: [{
            type: "text" as const,
            text: [
              `Reinforced with ${troopCount.toLocaleString()} ${troopResName} from ${structure.category} at ${structure_row_col(n, mapCtx)}`,
              `Army total: ~${newTotal.toLocaleString()} ${troopResName}`,
              `Remaining at structure: ~${Math.max(0, remaining).toLocaleString()} ${troopResName}`,
            ].join("\n"),
          }],
          details: { source: "structure", added: troopCount, newTotal },
        };
      }

      // ── No structure found — try to find an adjacent owned army of same type/tier ──

      for (const n of neighbors) {
        const nTile = mapCtx.snapshot.gridIndex.get(`${n.col},${n.row}`);
        if (!nTile || !isExplorer(nTile.occupierType)) continue;
        if (!mapCtx.snapshot.tiles.some(() => true)) continue; // dummy check for structure

        const sourceExplorer = await client.view.explorerInfo(nTile.occupierId);
        if (!sourceExplorer) continue;
        if (!addressesEqual(sourceExplorer.ownerAddress ?? "", playerAddress)) continue;
        if (sourceExplorer.troopType !== troopType || sourceExplorer.troopTier !== troopTier) continue;

        // Found a matching army — merge it
        const direction = getDirectionBetweenAdjacentHexes(
          { col: n.col, row: n.row },
          { col: x, row: y },
        );
        if (direction === null) continue;

        const sourceTotalRaw = Math.floor(sourceExplorer.troopCount * RESOURCE_PRECISION);
        // explorer_explorer_swap requires at least 1 troop to remain in source.
        // Transfer all-but-1, then delete the source army to free the slot.
        const maxTransferRaw = sourceTotalRaw - RESOURCE_PRECISION;
        if (maxTransferRaw <= 0) {
          continue; // Skip — source has only 1 troop, nothing to transfer
        }
        const transferAmount = params.amount
          ? Math.min(Math.floor(params.amount * RESOURCE_PRECISION), maxTransferRaw)
          : maxTransferRaw;

        try {
          await tx.provider.explorer_explorer_swap({
            from_explorer_id: sourceExplorer.entityId,
            to_explorer_id: explorer.entityId,
            to_explorer_direction: direction,
            count: transferAmount,
            signer: tx.signer,
          });
        } catch (err: any) {
          throw new Error(`Merge failed (${sourceExplorer.troopCount} ${troopResName} from army): ${extractTxError(err)}`);
        }

        const transferCount = Math.floor(transferAmount / RESOURCE_PRECISION);
        const mergedTotal = explorer.troopCount + transferCount;

        // Only delete source if we transferred everything possible (all-but-1)
        let slotFreed = false;
        if (transferAmount >= maxTransferRaw) {
          try {
            await tx.provider.explorer_delete({
              explorer_id: sourceExplorer.entityId,
              signer: tx.signer,
            });
            slotFreed = true;
          } catch {
            // Non-critical — troops merged but empty army remains
          }
        }

        const sourcePos = structure_row_col(n, mapCtx);
        return {
          content: [{
            type: "text" as const,
            text: [
              `Merged ${transferCount.toLocaleString()} ${troopResName} from army at ${sourcePos}`,
              `Army total: ~${mergedTotal.toLocaleString()} ${troopResName}`,
              slotFreed ? `Source army deleted — slot freed.` : "",
            ].filter(Boolean).join("\n"),
          }],
          details: { source: "army", added: transferCount, newTotal: mergedTotal, slotFreed },
        };
      }

      throw new Error(
        `No adjacent source found for ${troopResName}. ` +
          `Move the army next to an owned structure with ${troopResName} reserves, ` +
          `or next to another army of the same type/tier.`,
      );
    },
  };
}

/** Helper to convert hex coords back to map row:col for display. */
function structure_row_col(n: { col: number; row: number }, mapCtx: MapContext): string {
  if (!mapCtx.snapshot) return `${n.col},${n.row}`;
  const anchor = mapCtx.snapshot.anchor;
  const mapRow = anchor.maxY - n.row + 1;
  const mapCol = n.col - anchor.minX + 1;
  return `${mapRow}:${mapCol}`;
}
