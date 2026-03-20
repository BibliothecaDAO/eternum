/**
 * `open_chest` tool — open a relic chest adjacent to one of your armies.
 *
 * The army must be exactly 1 hex from the chest. Opening grants relics
 * and victory points. Tracks opened chests to prevent double-opens
 * before Torii indexes the change.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isChest } from "../world/occupier.js";
import { directionBetween } from "../world/pathfinding.js";

/**
 * Create the open_chest agent tool.
 *
 * @param client - Eternum client for fetching explorer data.
 * @param mapCtx - Map context holding the current tile snapshot and recently-opened chest tracking.
 * @param playerAddress - Hex address of the player; used to verify army ownership.
 * @param tx - Transaction context with the provider and signer.
 * @returns An AgentTool that opens a relic chest adjacent to one of the player's armies.
 */
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
      army_id: Type.Number({ description: "Entity ID of your army (from briefing or map_query)" }),
      chest_x: Type.Number({ description: "Chest world hex X coordinate" }),
      chest_y: Type.Number({ description: "Chest world hex Y coordinate" }),
    }),
    async execute(_toolCallId, params) {
      const { army_id: armyId, chest_x, chest_y } = params;
      const chestHex = { x: chest_x, y: chest_y };

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      // ── Find army ──

      const explorer = await client.view.explorerInfo(armyId);
      if (!explorer) {
        throw new Error(`Army ${armyId} not found.`);
      }

      // ── Verify ownership ──

      if (playerAddress && (!explorer.ownerAddress || !addressesEqual(explorer.ownerAddress, playerAddress))) {
        throw new Error(`Army ${armyId} is not yours.`);
      }

      // ── Find chest ──

      const chestTile = mapCtx.snapshot.gridIndex.get(`${chest_x},${chest_y}`) ?? null;
      if (!chestTile || !isChest(chestTile.occupierType)) {
        throw new Error(`No chest at (${chest_x},${chest_y}).`);
      }

      if (chestTile.rewardExtracted) {
        throw new Error(`Chest at (${chest_x},${chest_y}) has already been opened.`);
      }

      const chestKey = `${chest_x},${chest_y}`;
      if (mapCtx.recentlyOpenedChests?.has(chestKey)) {
        throw new Error(`Chest at (${chest_x},${chest_y}) was already opened this tick.`);
      }

      // ── Check adjacency ──

      const direction = directionBetween(explorer.position, chestHex);
      if (direction === null) {
        throw new Error(
          `Army ${armyId} is not adjacent to chest at (${chest_x},${chest_y}). Use move_army first to get within 1 hex.`,
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

      // Track that this chest was opened so other armies don't try again.
      if (!mapCtx.recentlyOpenedChests) mapCtx.recentlyOpenedChests = new Set();
      mapCtx.recentlyOpenedChests.add(chestKey);

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
            text: `Opened chest at (${chest_x},${chest_y}). Relics and victory points granted!`,
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
