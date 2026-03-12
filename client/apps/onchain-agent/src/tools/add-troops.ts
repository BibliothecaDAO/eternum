/**
 * add_troops — reinforce an existing army with additional troops from an adjacent realm.
 *
 * The agent points at an army on the map (row:col). The tool finds the
 * nearest adjacent owned structure, checks available troops matching the
 * army's type/tier, and transfers them.
 *
 * Requirement: the army must be adjacent to one of your structures.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { getNeighborHexes, getDirectionBetweenAdjacentHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isStructure } from "../world/occupier.js";

// Max troops to add in one call
const TARGET_TROOP_AMOUNT = 10_000 * RESOURCE_PRECISION;

// Troop type display name → resource name suffix
const TIER_SUFFIX: Record<string, string> = { T1: "T1", T2: "T2", T3: "T3" };

export function createAddTroopsTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "add_troops",
    label: "Add Troops",
    description:
      "Reinforce an existing army with more troops from an adjacent realm or structure. " +
      "The army must be next to one of your structures. " +
      "Automatically uses the same troop type/tier as the army and adds up to 10K (or all available). " +
      "Use this after creating an army to bulk it up before combat.",
    parameters: Type.Object({
      row: Type.Number({ description: "Line number of your army on the map" }),
      col: Type.Number({ description: "Column of your army on the map" }),
      amount: Type.Optional(
        Type.Number({ description: "Number of troops to add (default: all available, up to 10K)" }),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");

      // ── Validate map ──

      if (!mapCtx.snapshot) {
        throw new Error("Map not loaded yet. Wait for the next tick.");
      }

      const hexCoords = mapCtx.snapshot.resolve(row, col);
      if (!hexCoords) {
        throw new Error(
          `Invalid position ${row}:${col}. Map is ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols.`,
        );
      }

      // ── Find the army ──

      const tile = mapCtx.snapshot.tileAt(row, col);
      if (!tile || !isExplorer(tile.occupierType)) {
        throw new Error(`No army at ${row}:${col}. Point at one of your armies on the map.`);
      }

      const explorer = await client.view.explorerInfo(tile.occupierId);
      if (!explorer) {
        throw new Error(`Explorer ${tile.occupierId} not found.`);
      }

      if (playerAddress && !addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Army at ${row}:${col} is not yours.`);
      }

      // ── Find adjacent owned structure ──

      const { x, y } = hexCoords;
      const neighbors = getNeighborHexes(x, y);

      let adjacentStructure: {
        entityId: number;
        x: number;
        y: number;
        resources: { name: string; amount: number }[];
      } | null = null;

      for (const n of neighbors) {
        const nTile = mapCtx.snapshot.gridIndex.get(`${n.col},${n.row}`);
        if (!nTile || !isStructure(nTile.occupierType)) continue;

        const structure = await client.view.structureAt(n.col, n.row);
        if (!structure) continue;
        if (!addressesEqual(structure.ownerAddress, playerAddress)) continue;

        adjacentStructure = {
          entityId: structure.entityId,
          x: n.col,
          y: n.row,
          resources: structure.resources,
        };
        break;
      }

      if (!adjacentStructure) {
        throw new Error(
          "No adjacent owned structure found. Move the army next to one of your realms first.",
        );
      }

      // ── Determine troop type/tier and available amount ──

      const troopType = explorer.troopType; // e.g. "Knight"
      const troopTier = explorer.troopTier; // e.g. "T1"
      const tierSuffix = TIER_SUFFIX[troopTier] ?? "T1";
      const troopResName = `${troopType} ${tierSuffix}`;

      const availableDisplay = adjacentStructure.resources.find((r) => r.name === troopResName)?.amount ?? 0;
      const availableRaw = availableDisplay > 0 ? Math.floor(availableDisplay * RESOURCE_PRECISION) : 0;

      if (availableRaw <= 0) {
        const resSummary = adjacentStructure.resources.map((r) => `${r.amount.toLocaleString()} ${r.name}`).join(", ");
        throw new Error(
          `No ${troopResName} available at adjacent structure. Available: ${resSummary || "none"}`,
        );
      }

      const requestedRaw = params.amount ? Math.floor(params.amount * RESOURCE_PRECISION) : TARGET_TROOP_AMOUNT;
      const troopAmount = Math.min(requestedRaw, availableRaw);
      const troopCount = Math.floor(troopAmount / RESOURCE_PRECISION);

      // ── Compute home direction (from army to structure) ──

      const homeDirection = getDirectionBetweenAdjacentHexes(
        { col: x, row: y },
        { col: adjacentStructure.x, row: adjacentStructure.y },
      );

      if (homeDirection === null) {
        throw new Error("Could not compute direction from army to structure. They may not be adjacent.");
      }

      // ── Execute ──

      try {
        await tx.provider.explorer_add({
          to_explorer_id: explorer.entityId,
          amount: troopAmount,
          home_direction: homeDirection,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Add troops failed: ${extractTxError(err)}`);
      }

      const newTotal = explorer.troopCount + troopCount;
      const remainingDisplay = availableDisplay - troopCount;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Added ${troopCount.toLocaleString()} ${troopResName} to army at ${row}:${col}`,
              `Army total: ~${newTotal.toLocaleString()} ${troopResName}`,
              `Remaining at structure: ~${Math.max(0, remainingDisplay).toLocaleString()} ${troopResName}`,
            ].join("\n"),
          },
        ],
        details: {
          explorerId: explorer.entityId,
          troopType,
          troopTier,
          added: troopCount,
          newTotal,
        },
      };
    },
  };
}
