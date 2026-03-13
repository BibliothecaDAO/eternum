/**
 * Adjacent transfer tools — move resources between adjacent entities (troops and structures).
 *
 * Three directions:
 *   - troop → troop  (troop_troop_adjacent_transfer)
 *   - troop → structure  (troop_structure_adjacent_transfer)
 *   - structure → troop  (structure_troop_adjacent_transfer)
 *
 * These are needed in Blitz primarily for moving relics between entities,
 * but also work for any resource type. Entities must be on adjacent hex tiles.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isExplorer, isStructure } from "../world/occupier.js";

/** Resource name→ID mapping for adjacent transfers. */
const RESOURCE_NAME_TO_ID: Record<string, number> = {
  Stone: 1,
  Coal: 2,
  Wood: 3,
  Copper: 4,
  Ironwood: 5,
  Obsidian: 6,
  Gold: 7,
  Silver: 8,
  Mithral: 9,
  AlchemicalSilver: 10,
  ColdIron: 11,
  DeepCrystal: 12,
  Ruby: 13,
  Diamonds: 14,
  Hartwood: 15,
  Ignium: 16,
  TwilightQuartz: 17,
  TrueIce: 18,
  Adamantine: 19,
  Sapphire: 20,
  EtherealSilica: 21,
  Dragonhide: 22,
  Labor: 23,
  AncientFragment: 24,
  Donkey: 25,
  "Knight T1": 26,
  "Knight T2": 27,
  "Knight T3": 28,
  "Crossbowman T1": 29,
  "Crossbowman T2": 30,
  "Crossbowman T3": 31,
  "Paladin T1": 32,
  "Paladin T2": 33,
  "Paladin T3": 34,
  Wheat: 35,
  Fish: 36,
  Lords: 37,
  Essence: 38,
};

const ResourceSchema = Type.Object({
  resource_name: Type.String({ description: "Resource name (e.g. 'Wood', 'Knight T1', 'Essence')" }),
  amount: Type.Number({ description: "Amount to transfer (human-readable)" }),
});

/**
 * Create the troop_troop_adjacent_transfer tool.
 */
export function createTroopTroopAdjacentTransferTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "troop_troop_adjacent_transfer",
    label: "Troop→Troop Transfer",
    description:
      "Transfer resources between two of your adjacent armies (explorers). " +
      "Both explorers must be on adjacent hexes and owned by you. " +
      "Primarily used for moving relics between armies.",
    parameters: Type.Object({
      from_row: Type.Number({ description: "Row of the source explorer" }),
      from_col: Type.Number({ description: "Column of the source explorer" }),
      to_row: Type.Number({ description: "Row of the destination explorer" }),
      to_col: Type.Number({ description: "Column of the destination explorer" }),
      resources: Type.Array(ResourceSchema, {
        description: "Resources to transfer",
        minItems: 1,
      }),
    }),
    async execute(_toolCallId, params, signal) {
      const { from_row, from_col, to_row, to_col, resources } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      // Validate source explorer
      const fromTile = mapCtx.snapshot.tileAt(from_row, from_col);
      if (!fromTile || !isExplorer(fromTile.occupierType)) {
        throw new Error(`No explorer at ${from_row}:${from_col}.`);
      }
      const fromExplorer = await client.view.explorerInfo(fromTile.occupierId);
      if (!fromExplorer) throw new Error(`Source explorer not found.`);
      if (!addressesEqual(fromExplorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Source explorer is not yours.`);
      }

      // Validate destination explorer
      const toTile = mapCtx.snapshot.tileAt(to_row, to_col);
      if (!toTile || !isExplorer(toTile.occupierType)) {
        throw new Error(`No explorer at ${to_row}:${to_col}.`);
      }
      const toExplorer = await client.view.explorerInfo(toTile.occupierId);
      if (!toExplorer) throw new Error(`Destination explorer not found.`);
      if (!addressesEqual(toExplorer.ownerAddress ?? "", playerAddress)) {
        throw new Error(`Destination explorer is not yours.`);
      }

      // Build resource array
      const resourceCalldata = resolveResources(resources);

      try {
        await tx.provider.troop_troop_adjacent_transfer({
          from_troop_id: fromExplorer.entityId,
          to_troop_id: toExplorer.entityId,
          resources: resourceCalldata,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Troop→troop transfer failed: ${extractTxError(err)}`);
      }

      const summary = resources
        .map((r: { resource_name: string; amount: number }) => `${r.amount} ${r.resource_name}`)
        .join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Transferred ${summary} from explorer at ${from_row}:${from_col} → explorer at ${to_row}:${to_col}.`,
          },
        ],
        details: {
          fromId: fromExplorer.entityId,
          toId: toExplorer.entityId,
          resources: resourceCalldata,
        },
      };
    },
  };
}

/**
 * Create the troop_structure_adjacent_transfer tool.
 */
export function createTroopStructureAdjacentTransferTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "troop_structure_adjacent_transfer",
    label: "Troop→Structure Transfer",
    description:
      "Transfer resources from one of your explorers (army) to an adjacent structure. " +
      "The explorer must be adjacent to the structure. Both must be owned by you. " +
      "Used for depositing relics into structures or offloading loot.",
    parameters: Type.Object({
      explorer_row: Type.Number({ description: "Row of the source explorer" }),
      explorer_col: Type.Number({ description: "Column of the source explorer" }),
      structure_row: Type.Number({ description: "Row of the destination structure" }),
      structure_col: Type.Number({ description: "Column of the destination structure" }),
      resources: Type.Array(ResourceSchema, {
        description: "Resources to transfer",
        minItems: 1,
      }),
    }),
    async execute(_toolCallId, params, signal) {
      const { explorer_row, explorer_col, structure_row, structure_col, resources } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

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

      // Validate structure
      const structHex = mapCtx.snapshot.resolve(structure_row, structure_col);
      if (!structHex) throw new Error(`Invalid structure position ${structure_row}:${structure_col}.`);
      const structTile = mapCtx.snapshot.tileAt(structure_row, structure_col);
      if (!structTile || !isStructure(structTile.occupierType)) {
        throw new Error(`No structure at ${structure_row}:${structure_col}.`);
      }
      const structure = await client.view.structureAt(structHex.x, structHex.y);
      if (!structure) throw new Error(`Structure not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure is not yours.`);
      }

      const resourceCalldata = resolveResources(resources);

      try {
        await tx.provider.troop_structure_adjacent_transfer({
          from_explorer_id: explorer.entityId,
          to_structure_id: structure.entityId,
          resources: resourceCalldata,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Troop→structure transfer failed: ${extractTxError(err)}`);
      }

      const summary = resources
        .map((r: { resource_name: string; amount: number }) => `${r.amount} ${r.resource_name}`)
        .join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Transferred ${summary} from explorer at ${explorer_row}:${explorer_col} → ${structure.category} at ${structure_row}:${structure_col}.`,
          },
        ],
        details: {
          fromId: explorer.entityId,
          toId: structure.entityId,
          resources: resourceCalldata,
        },
      };
    },
  };
}

/**
 * Create the structure_troop_adjacent_transfer tool.
 */
export function createStructureTroopAdjacentTransferTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "structure_troop_adjacent_transfer",
    label: "Structure→Troop Transfer",
    description:
      "Transfer resources from one of your structures to an adjacent explorer (army). " +
      "The explorer must be adjacent to the structure. Both must be owned by you. " +
      "Used for loading relics onto armies or equipping them with resources.",
    parameters: Type.Object({
      structure_row: Type.Number({ description: "Row of the source structure" }),
      structure_col: Type.Number({ description: "Column of the source structure" }),
      explorer_row: Type.Number({ description: "Row of the destination explorer" }),
      explorer_col: Type.Number({ description: "Column of the destination explorer" }),
      resources: Type.Array(ResourceSchema, {
        description: "Resources to transfer",
        minItems: 1,
      }),
    }),
    async execute(_toolCallId, params, signal) {
      const { structure_row, structure_col, explorer_row, explorer_col, resources } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      // Validate structure
      const structHex = mapCtx.snapshot.resolve(structure_row, structure_col);
      if (!structHex) throw new Error(`Invalid structure position ${structure_row}:${structure_col}.`);
      const structTile = mapCtx.snapshot.tileAt(structure_row, structure_col);
      if (!structTile || !isStructure(structTile.occupierType)) {
        throw new Error(`No structure at ${structure_row}:${structure_col}.`);
      }
      const structure = await client.view.structureAt(structHex.x, structHex.y);
      if (!structure) throw new Error(`Structure not found.`);
      if (!addressesEqual(structure.ownerAddress, playerAddress)) {
        throw new Error(`Structure is not yours.`);
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

      const resourceCalldata = resolveResources(resources);

      try {
        await tx.provider.structure_troop_adjacent_transfer({
          from_structure_id: structure.entityId,
          to_troop_id: explorer.entityId,
          resources: resourceCalldata,
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Structure→troop transfer failed: ${extractTxError(err)}`);
      }

      const summary = resources
        .map((r: { resource_name: string; amount: number }) => `${r.amount} ${r.resource_name}`)
        .join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Transferred ${summary} from ${structure.category} at ${structure_row}:${structure_col} → explorer at ${explorer_row}:${explorer_col}.`,
          },
        ],
        details: {
          fromId: structure.entityId,
          toId: explorer.entityId,
          resources: resourceCalldata,
        },
      };
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Resolve human-readable resource names+amounts to provider calldata format.
 * Returns array of { resourceId, amount } with amounts in raw (precision-scaled) form.
 */
function resolveResources(
  resources: Array<{ resource_name: string; amount: number }>,
): Array<{ resourceId: number; amount: number }> {
  return resources.map(({ resource_name, amount }) => {
    const resourceId = RESOURCE_NAME_TO_ID[resource_name];
    if (resourceId === undefined) {
      const available = Object.keys(RESOURCE_NAME_TO_ID).join(", ");
      throw new Error(`Unknown resource "${resource_name}". Available: ${available}`);
    }
    return {
      resourceId,
      amount: Math.floor(amount * RESOURCE_PRECISION),
    };
  });
}
