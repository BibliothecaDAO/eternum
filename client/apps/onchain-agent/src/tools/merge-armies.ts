/**
 * merge_armies — merge two adjacent armies of the same type/tier into one.
 *
 * Transfers all troops from the source army into the target army,
 * then deletes the empty source to free the army slot.
 * Both armies must be yours, adjacent, and the same troop type/tier.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getDirectionBetweenAdjacentHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer } from "../world/occupier.js";

export function createMergeArmiesTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "merge_armies",
    label: "Merge Armies",
    description:
      "Merge two adjacent armies into one. Transfers all troops from the source into the target, " +
      "then deletes the empty source to free the army slot. " +
      "Both armies must be yours, adjacent, and the same troop type and tier. " +
      "Use this to consolidate weak armies into one strong force before attacking.",
    parameters: Type.Object({
      source_row: Type.Number({ description: "Line number of the army to merge FROM (will be deleted)" }),
      source_col: Type.Number({ description: "Column of the army to merge FROM" }),
      target_row: Type.Number({ description: "Line number of the army to merge INTO (will receive troops)" }),
      target_col: Type.Number({ description: "Column of the army to merge INTO" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { source_row, source_col, target_row, target_col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      // ── Resolve both armies ──

      const sourceHex = mapCtx.snapshot.resolve(source_row, source_col);
      const targetHex = mapCtx.snapshot.resolve(target_row, target_col);
      if (!sourceHex) throw new Error(`Invalid source position ${source_row}:${source_col}.`);
      if (!targetHex) throw new Error(`Invalid target position ${target_row}:${target_col}.`);

      const sourceTile = mapCtx.snapshot.tileAt(source_row, source_col);
      const targetTile = mapCtx.snapshot.tileAt(target_row, target_col);

      if (!sourceTile || !isExplorer(sourceTile.occupierType)) {
        throw new Error(`No army at ${source_row}:${source_col}.`);
      }
      if (!targetTile || !isExplorer(targetTile.occupierType)) {
        throw new Error(`No army at ${target_row}:${target_col}.`);
      }

      const sourceExplorer = await client.view.explorerInfo(sourceTile.occupierId);
      const targetExplorer = await client.view.explorerInfo(targetTile.occupierId);

      if (!sourceExplorer) throw new Error(`Source explorer ${sourceTile.occupierId} not found.`);
      if (!targetExplorer) throw new Error(`Target explorer ${targetTile.occupierId} not found.`);

      // ── Verify ownership ──

      if (!addressesEqual(sourceExplorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Source army at ${source_row}:${source_col} is not yours.`);
      }
      if (!addressesEqual(targetExplorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Target army at ${target_row}:${target_col} is not yours.`);
      }

      // ── Verify same type/tier ──

      if (sourceExplorer.troopType !== targetExplorer.troopType) {
        throw new Error(
          `Type mismatch: source is ${sourceExplorer.troopType}, target is ${targetExplorer.troopType}. ` +
            `Both must be the same type to merge.`,
        );
      }
      if (sourceExplorer.troopTier !== targetExplorer.troopTier) {
        throw new Error(
          `Tier mismatch: source is ${sourceExplorer.troopTier}, target is ${targetExplorer.troopTier}. ` +
            `Both must be the same tier to merge.`,
        );
      }

      // ── Check adjacency ──

      const direction = getDirectionBetweenAdjacentHexes(
        { col: sourceHex.x, row: sourceHex.y },
        { col: targetHex.x, row: targetHex.y },
      );

      if (direction === null) {
        throw new Error(
          `Armies at ${source_row}:${source_col} and ${target_row}:${target_col} are not adjacent. ` +
            `Move them next to each other first.`,
        );
      }

      // ── Step 1: Transfer all troops from source to target ──

      const transferAmount = Math.floor(sourceExplorer.troopCount * RESOURCE_PRECISION);

      try {
        await tx.provider.explorer_explorer_swap({
          from_explorer_id: sourceExplorer.entityId,
          to_explorer_id: targetExplorer.entityId,
          to_explorer_direction: direction,
          count: transferAmount,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Troop transfer failed: ${extractTxError(err)}`);
      }

      // ── Step 2: Delete the empty source army ──

      try {
        await tx.provider.explorer_delete({
          explorer_id: sourceExplorer.entityId,
          signer: tx.signer,
        });
      } catch (err: any) {
        // Transfer succeeded but delete failed — troops are merged but slot isn't freed
        const mergedTotal = sourceExplorer.troopCount + targetExplorer.troopCount;
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Troops transferred but failed to delete empty army: ${extractTxError(err)}`,
                `Target army now has ~${mergedTotal.toLocaleString()} ${sourceExplorer.troopType} ${sourceExplorer.troopTier}`,
                `Source army at ${source_row}:${source_col} is empty — try deleting it manually.`,
              ].join("\n"),
            },
          ],
          details: { partial: true },
        };
      }

      const mergedTotal = sourceExplorer.troopCount + targetExplorer.troopCount;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Merged ${sourceExplorer.troopCount.toLocaleString()} ${sourceExplorer.troopType} ${sourceExplorer.troopTier} into army at ${target_row}:${target_col}`,
              `Target army total: ~${mergedTotal.toLocaleString()} ${sourceExplorer.troopType} ${sourceExplorer.troopTier}`,
              `Army slot freed at ${source_row}:${source_col}`,
            ].join("\n"),
          },
        ],
        details: {
          sourceId: sourceExplorer.entityId,
          targetId: targetExplorer.entityId,
          transferred: sourceExplorer.troopCount,
          newTotal: mergedTotal,
        },
      };
    },
  };
}
