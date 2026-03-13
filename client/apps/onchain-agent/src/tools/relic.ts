/**
 * apply_relic — apply a relic bonus to an entity (structure or explorer).
 *
 * Relics are stored as resources on entities. Once you have a relic resource,
 * use this tool to activate its bonus on a structure (realm, hyperstructure)
 * or an explorer. Relics provide combat/production bonuses in Blitz mode.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isStructure, isExplorer } from "../world/occupier.js";

/**
 * Recipient type enum matching on-chain values.
 * 0 = structure, 1 = explorer (troop).
 */
const RECIPIENT_TYPE = { structure: 0, explorer: 1 } as const;

/**
 * Create the apply_relic agent tool.
 *
 * @param client - Eternum client for fetching entity data.
 * @param mapCtx - Map context holding the current tile snapshot.
 * @param playerAddress - Hex address of the player; used to verify ownership.
 * @param tx - Transaction context with the provider and signer.
 * @returns An AgentTool that applies a relic bonus to an entity.
 */
export function createApplyRelicTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "apply_relic",
    label: "Apply Relic",
    description:
      "Apply a relic bonus to one of your entities (structure or explorer). " +
      "Relics are resources stored on entities — use adjacent transfer tools to move them first if needed. " +
      "Specify the entity position, the relic resource ID, and the recipient type ('structure' or 'explorer'). " +
      "Use inspect_tile to check which relic resources an entity has.",
    parameters: Type.Object({
      row: Type.Number({ description: "Row of the entity holding the relic" }),
      col: Type.Number({ description: "Column of the entity" }),
      relic_resource_id: Type.Number({ description: "Resource ID of the relic to apply" }),
      recipient_type: Type.Union([Type.Literal("structure"), Type.Literal("explorer")], {
        description: "Type of entity to apply the relic to: 'structure' or 'explorer'",
      }),
    }),
    async execute(_toolCallId, params, signal) {
      const { row, col, relic_resource_id, recipient_type } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      const hex = mapCtx.snapshot.resolve(row, col);
      if (!hex) throw new Error(`Invalid position ${row}:${col}.`);

      const tile = mapCtx.snapshot.tileAt(row, col);
      if (!tile) throw new Error(`Tile ${row}:${col} is unexplored.`);

      let entityId: number;
      let entityLabel: string;

      if (recipient_type === "structure") {
        if (!isStructure(tile.occupierType)) {
          throw new Error(`No structure at ${row}:${col}. Use recipient_type='explorer' for armies.`);
        }
        const structure = await client.view.structureAt(hex.x, hex.y);
        if (!structure) throw new Error(`Structure at ${row}:${col} not found.`);
        if (!addressesEqual(structure.ownerAddress, playerAddress)) {
          throw new Error(`Structure at ${row}:${col} is not yours.`);
        }
        entityId = structure.entityId;
        entityLabel = `${structure.category} at ${row}:${col}`;
      } else {
        if (!isExplorer(tile.occupierType)) {
          throw new Error(`No explorer at ${row}:${col}. Use recipient_type='structure' for structures.`);
        }
        const explorer = await client.view.explorerInfo(tile.occupierId);
        if (!explorer) throw new Error(`Explorer at ${row}:${col} not found.`);
        if (!addressesEqual(explorer.ownerAddress ?? "", playerAddress)) {
          throw new Error(`Explorer at ${row}:${col} is not yours.`);
        }
        entityId = explorer.entityId;
        entityLabel = `explorer at ${row}:${col}`;
      }

      const recipientTypeOnChain = RECIPIENT_TYPE[recipient_type as keyof typeof RECIPIENT_TYPE];

      try {
        await tx.provider.apply_relic({
          entity_id: entityId,
          relic_resource_id,
          recipient_type: recipientTypeOnChain,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Apply relic failed: ${extractTxError(err)}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Applied relic (resource ID ${relic_resource_id}) to ${entityLabel}.`,
          },
        ],
        details: {
          entityId,
          relicResourceId: relic_resource_id,
          recipientType: recipient_type,
        },
      };
    },
  };
}
