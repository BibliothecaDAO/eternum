/**
 * open_chest tool — open a relic chest adjacent to one of your armies.
 *
 * The agent points at its army (army_row:army_col) and the chest (chest_row:chest_col).
 * The army must be adjacent to the chest (1 hex away).
 * Opening grants relics and victory points.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isChest } from "../world/occupier.js";
import { directionBetween } from "../world/pathfinding.js";

export function createOpenChestTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "open_chest",
    label: "Open Chest",
    description:
      "Open a relic chest adjacent to one of your armies. Your army must be exactly 1 hex away from the chest. " +
      "Grants relics and victory points. Use move_army first to get adjacent, then open_chest. " +
      "Returns: success/failure and relics obtained.",
    parameters: Type.Object({
      army_row: Type.Number({ description: "Line number of your army on the map" }),
      army_col: Type.Number({ description: "Column of your army on the map" }),
      target_row: Type.Number({ description: "Line number of the chest on the map" }),
      target_col: Type.Number({ description: "Column of the chest on the map" }),
    }),
    async execute(_toolCallId, params) {
      const { army_row, army_col, target_row: chest_row, target_col: chest_col } = params;

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      // ── Find army ──

      const armyTile = mapCtx.snapshot.tileAt(army_row, army_col);
      if (!armyTile || !isExplorer(armyTile.occupierType)) {
        throw new Error(`No army at ${army_row}:${army_col}. Point at one of your armies on the map.`);
      }

      const explorer = await client.view.explorerInfo(armyTile.occupierId);
      if (!explorer) {
        throw new Error(`Explorer ${armyTile.occupierId} not found.`);
      }

      // ── Verify ownership ──

      if (playerAddress && (!explorer.ownerAddress || !addressesEqual(explorer.ownerAddress, playerAddress))) {
        throw new Error(`Army at ${army_row}:${army_col} is not yours.`);
      }

      // ── Find chest ──

      const chestTile = mapCtx.snapshot.tileAt(chest_row, chest_col);
      if (!chestTile || !isChest(chestTile.occupierType)) {
        throw new Error(`No chest at ${chest_row}:${chest_col}.`);
      }

      if (chestTile.rewardExtracted) {
        throw new Error(`Chest at ${chest_row}:${chest_col} has already been opened.`);
      }

      // ── Check adjacency ──

      const chestHex = mapCtx.snapshot.resolve(chest_row, chest_col);
      if (!chestHex) {
        throw new Error(`Invalid chest position ${chest_row}:${chest_col}.`);
      }

      const direction = directionBetween(explorer.position, chestHex);
      if (direction === null) {
        throw new Error(
          `Army at ${army_row}:${army_col} is not adjacent to chest at ${chest_row}:${chest_col}. Use move_army first to get within 1 hex.`,
        );
      }

      // ── Open chest ──

      try {
        await tx.provider.open_chest({
          explorer_id: explorer.entityId,
          chest_coord: {
            alt: false,
            x: chestHex.x,
            y: chestHex.y,
          },
          signer: tx.signer,
        });
      } catch (err: any) {
        const errStr = extractTxError(err);
        throw new Error(`Failed to open chest: ${errStr}`);
      }

      // Refresh map — chest is now removed from the tile
      try {
        await mapCtx.refresh?.();
      } catch {
        // Non-fatal
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Opened chest at ${chest_row}:${chest_col}. Relics and victory points granted!`,
          },
        ],
        details: {
          chestPosition: chestHex,
          explorerId: explorer.entityId,
        },
      };
    },
  };
}
