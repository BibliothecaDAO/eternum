/**
 * allocate_shares — allocate ownership shares of a captured hyperstructure.
 *
 * In Blitz, after capturing a hyperstructure, the agent should automatically
 * allocate 100% shares to itself. The game client does this automatically
 * via BlitzSetHyperstructureShareholdersTo100, but the headless agent
 * needs to do it explicitly.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isStructure } from "../world/occupier.js";

/**
 * Create the allocate_shares agent tool.
 *
 * @param client - Eternum client for fetching structure data.
 * @param mapCtx - Map context holding the current tile snapshot.
 * @param playerAddress - Hex address of the player; used to verify ownership and allocate 100%.
 * @param tx - Transaction context with the provider and signer.
 * @returns An AgentTool that allocates hyperstructure ownership shares.
 */
export function createAllocateSharesTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "allocate_shares",
    label: "Allocate HS Shares",
    description:
      "Allocate ownership shares of a captured hyperstructure. " +
      "In Blitz, call this immediately after capturing a hyperstructure to claim 100% ownership. " +
      "This generates victory points. Specify the hyperstructure position. " +
      "By default allocates 100% to yourself. Optionally specify co-owners with percentages.",
    parameters: Type.Object({
      row: Type.Number({ description: "Row of the hyperstructure" }),
      col: Type.Number({ description: "Column of the hyperstructure" }),
      co_owners: Type.Optional(
        Type.Array(
          Type.Object({
            address: Type.String({ description: "Co-owner address (hex)" }),
            percentage: Type.Number({ description: "Percentage (0–10000, where 10000 = 100%)" }),
          }),
          { description: "Co-owners and their shares. Default: 100% to self." },
        ),
      ),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      const hex = mapCtx.snapshot.resolve(row, col);
      if (!hex) throw new Error(`Invalid position ${row}:${col}.`);

      const tile = mapCtx.snapshot.tileAt(row, col);
      if (!tile || !isStructure(tile.occupierType)) {
        throw new Error(`No structure at ${row}:${col}.`);
      }

      const structure = await client.view.structureAt(hex.x, hex.y);
      if (!structure) throw new Error(`Structure at ${row}:${col} not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Hyperstructure at ${row}:${col} is not yours. Capture it first.`);
      }

      // Default: 100% to self (10000 = 100% in contract units)
      const coOwners: [string, number][] = params.co_owners
        ? params.co_owners.map(
            (o: { address: string; percentage: number }) => [o.address, o.percentage] as [string, number],
          )
        : [[playerAddress, 10000]];

      try {
        await tx.provider.allocate_shares({
          hyperstructure_entity_id: structure.entityId,
          co_owners: coOwners as [string, number][],
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Allocate shares failed: ${extractTxError(err)}`);
      }

      const sharesSummary = coOwners
        .map(([addr, pct]: [string, number]) => `${(pct / 100).toFixed(1)}% → ${addr.slice(0, 10)}...`)
        .join(", ");

      return {
        content: [
          {
            type: "text" as const,
            text: `Shares allocated for hyperstructure at ${row}:${col}: ${sharesSummary}`,
          },
        ],
        details: {
          structureId: structure.entityId,
          coOwners,
        },
      };
    },
  };
}
