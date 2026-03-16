/**
 * transfer_resources — send resources from one of your structures to another.
 *
 * Delivers resources by donkey caravan. Donkeys are consumed based on total weight.
 * Travel time scales with distance.
 *
 * Weights: standard resources ~1kg, troops ~5kg, wheat/fish/essence/ancient fragment ~0.1kg,
 * donkeys and lords 0kg. Each donkey carries 50kg.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { EternumClient } from "@bibliothecadao/client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { MapContext } from "../map/context.js";
import { type TxContext, addressesEqual, extractTxError } from "./tx-context.js";
import { isStructure } from "../world/occupier.js";

/**
 * Per-unit resource weight in grams, keyed by resource ID. Derived from the on-chain WeightConfig.
 * Standard resources: 1kg. Troops: 5kg. Wheat/Fish/Essence/AncientFragment: 0.1kg. Donkeys/Lords: 0g.
 */
const RESOURCE_WEIGHT_GRAMS: Record<number, number> = {};
// Standard resources (IDs 1-23): 1000g (1kg) each
for (let i = 1; i <= 23; i++) RESOURCE_WEIGHT_GRAMS[i] = 1000;
// AncientFragment=24: 100g (0.1kg)
RESOURCE_WEIGHT_GRAMS[24] = 100;
// Donkey=25: 0g (free)
RESOURCE_WEIGHT_GRAMS[25] = 0;
// Troops: Knight/Crossbow/Paladin T1-T3 (IDs 26-34): 5000g (5kg) each
for (let i = 26; i <= 34; i++) RESOURCE_WEIGHT_GRAMS[i] = 5000;
// Wheat=35, Fish=36: 100g (0.1kg) each
RESOURCE_WEIGHT_GRAMS[35] = 100;
RESOURCE_WEIGHT_GRAMS[36] = 100;
// Lords=37: 0g (free)
RESOURCE_WEIGHT_GRAMS[37] = 0;
// Essence=38: 100g (0.1kg)
RESOURCE_WEIGHT_GRAMS[38] = 100;

/** Maximum cargo weight per donkey, in grams (50kg per WorldConfig). */
const DONKEY_CAPACITY_GRAMS = 50_000; // 50kg

/**
 * Maps resource names to their on-chain resource IDs.
 * Sourced from the ResourcesIds enum in @bibliothecadao/types.
 */
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

/**
 * Create the transfer_resources agent tool.
 *
 * @param client - Eternum client for fetching structure data and resource balances.
 * @param mapCtx - Map context holding the current tile snapshot for position resolution.
 * @param playerAddress - Hex address of the player; used to verify ownership of both structures.
 * @param tx - Transaction context with the provider and signer.
 * @returns An AgentTool that sends resources from one owned structure to another via donkey caravan.
 */
export function createTransferResourcesTool(
  client: EternumClient,
  mapCtx: MapContext,
  playerAddress: string,
  tx: TxContext,
): AgentTool<any> {
  return {
    name: "transfer_resources",
    label: "Transfer Resources",
    description:
      "Send resources from one of your structures to another via donkey caravan. " +
      "Donkeys are consumed based on weight: ~1kg per standard resource, ~5kg per troop, wheat is free. " +
      "Each donkey carries 50kg. Travel takes time based on distance. " +
      "Specify resource name and amount. Check YOUR ENTITIES for available resources. " +
      "Resources arrive automatically (auto-offloaded by automation).",
    parameters: Type.Object({
      from_structure_id: Type.Number({ description: "Entity ID of the sending structure" }),
      to_structure_id: Type.Number({ description: "Entity ID of the receiving structure" }),
      resource_name: Type.String({ description: "Resource to send (e.g. 'Wheat', 'Wood', 'Knight T1', 'Paladin T1')" }),
      amount: Type.Number({ description: "Amount to send (human-readable, e.g. 1000 for 1000 wheat)" }),
    }),
    async execute(_toolCallId, params, signal) {
      const { from_structure_id: fromId, to_structure_id: toId, resource_name, amount } = params;

      if (signal?.aborted) throw new Error("Operation cancelled");
      if (!mapCtx.snapshot) throw new Error("Map not loaded yet. Wait for the next tick.");

      // ── Find structure tiles by entity ID ──

      let fromTile = null as any;
      let toTile = null as any;
      for (const t of mapCtx.snapshot.tiles) {
        if (t.occupierId === fromId) fromTile = t;
        if (t.occupierId === toId) toTile = t;
      }

      if (!fromTile || !isStructure(fromTile.occupierType)) {
        throw new Error(`Source structure ${fromId} not found.`);
      }
      if (!toTile || !isStructure(toTile.occupierType)) {
        throw new Error(`Target structure ${toId} not found.`);
      }

      const fromHex = fromTile.position;
      const toHex = toTile.position;

      const fromStructure = await client.view.structureAt(fromHex.x, fromHex.y);
      const toStructure = await client.view.structureAt(toHex.x, toHex.y);

      if (!fromStructure) throw new Error(`Source structure ${fromId} not found.`);
      if (!toStructure) throw new Error(`Target structure ${toId} not found.`);

      if (!addressesEqual(fromStructure.ownerAddress, playerAddress)) {
        throw new Error(`Source structure ${fromId} is not yours.`);
      }
      if (!addressesEqual(toStructure.ownerAddress, playerAddress)) {
        throw new Error(`Target structure ${toId} is not yours.`);
      }

      // ── Resolve resource ──

      const resourceId = RESOURCE_NAME_TO_ID[resource_name];
      if (resourceId === undefined) {
        const available = Object.keys(RESOURCE_NAME_TO_ID).join(", ");
        throw new Error(`Unknown resource "${resource_name}". Available: ${available}`);
      }

      // Check balance
      const balance = fromStructure.resources.find((r) => r.name === resource_name);
      if (!balance || balance.amount <= 0) {
        const resSummary = fromStructure.resources
          .filter((r) => r.amount > 0)
          .map((r) => `${r.amount.toLocaleString()} ${r.name}`)
          .join(", ");
        throw new Error(`No ${resource_name} at source. Available: ${resSummary || "none"}`);
      }

      const sendAmount = Math.min(amount, balance.amount);
      const sendRaw = BigInt(Math.floor(sendAmount * RESOURCE_PRECISION));

      // ── Compute donkey cost ──

      const weightGrams = RESOURCE_WEIGHT_GRAMS[resourceId] ?? 1000;
      const totalWeightGrams = sendAmount * weightGrams;
      const donkeysNeeded = totalWeightGrams > 0 ? Math.ceil(totalWeightGrams / DONKEY_CAPACITY_GRAMS) : 0;

      // Check donkey balance
      if (donkeysNeeded > 0) {
        const donkeyBalance = fromStructure.resources.find((r) => r.name === "Donkey");
        const availableDonkeys = donkeyBalance?.amount ?? 0;
        if (availableDonkeys < donkeysNeeded) {
          throw new Error(
            `Need ${donkeysNeeded} donkeys to send ${sendAmount.toLocaleString()} ${resource_name} ` +
              `(${(totalWeightGrams / 1000).toFixed(1)}kg total). Only ${Math.floor(availableDonkeys)} donkeys available.`,
          );
        }
      }

      // ── Compute travel time estimate ──

      const dx = toHex.x - fromHex.x;
      const dy = toHex.y - fromHex.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const donkeySecPerKm = 9; // from WorldConfig
      const travelTimeSec = Math.floor(distance * donkeySecPerKm);
      const travelTimeMin = Math.ceil(travelTimeSec / 60);

      // ── Execute send ──

      try {
        await tx.provider.send_resources({
          sender_entity_id: fromStructure.entityId,
          recipient_entity_id: toStructure.entityId,
          resources: [{ resource: resourceId, amount: sendRaw }],
          signer: tx.signer,
        });
      } catch (err: any) {
        throw new Error(`Transfer failed: ${extractTxError(err)}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Sent ${sendAmount.toLocaleString()} ${resource_name} from ${fromStructure.category} ${fromId} at (${fromHex.x},${fromHex.y}) → ${toStructure.category} ${toId} at (${toHex.x},${toHex.y})`,
              donkeysNeeded > 0 ? `Donkeys burnt: ${donkeysNeeded}` : "No donkeys needed (zero weight)",
              `Estimated arrival: ~${travelTimeMin} min (${distance.toFixed(1)} km)`,
              `Resources will be auto-offloaded on arrival.`,
            ].join("\n"),
          },
        ],
        details: {
          fromEntityId: fromStructure.entityId,
          toEntityId: toStructure.entityId,
          resourceId,
          resourceName: resource_name,
          amount: sendAmount,
          donkeysBurnt: donkeysNeeded,
          estimatedTravelMin: travelTimeMin,
        },
      };
    },
  };
}
