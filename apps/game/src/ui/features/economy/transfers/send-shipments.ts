import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { isDefinitelyNotApplied, type SentCommand } from "@/sync/action-outcome";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

/** One destination's goods, in whole units. */
export interface Shipment {
  destinationId: number;
  destinationName: string;
  lines: Array<{ resource: number; amount: number }>;
}

/** A send of one holding's goods to one holding, as the chain takes it. */
interface ShipmentCall {
  sender_entity_id: bigint;
  recipient_entity_id: bigint;
  resources: Array<number | bigint>;
}

/**
 * How one shipment ended: applied; refused (the game applied nothing, or the shard never took it), so sending it
 * again is safe; or unknown (no answer, or a failure that does not say), so it may still land and is never sent
 * again by itself. `busy`: this pair already had a shipment in flight, and nothing was sent.
 */
export type ShipmentOutcome =
  | { shipment: Shipment; status: "applied" }
  | { shipment: Shipment; status: "refused" | "unknown"; error: unknown }
  | { shipment: Shipment; status: "busy" };

/**
 * Sends each destination's shipment as its own action, all at once, and resolves with each one's outcome. The game
 * takes one command per transaction and one recipient per command, so shipments to several holdings cannot land as
 * one: each is followed to its own outcome instead, and only those definitely not applied are offered again.
 */
export const sendShipments = (
  sourceId: number,
  shipments: Shipment[],
  send: (call: ShipmentCall) => Promise<SentCommand>,
): Promise<ShipmentOutcome[]> => Promise.all(shipments.map((shipment) => sendShipment(sourceId, shipment, send)));

const sendShipment = async (
  sourceId: number,
  shipment: Shipment,
  send: (call: ShipmentCall) => Promise<SentCommand>,
): Promise<ShipmentOutcome> => {
  try {
    const applied = await sendOnce("shipment", `${sourceId}>${shipment.destinationId}`, true, () =>
      send(shipmentCall(sourceId, shipment)),
    );
    return applied === null ? { shipment, status: "busy" } : { shipment, status: "applied" };
  } catch (error) {
    return { shipment, status: isDefinitelyNotApplied(error) ? "refused" : "unknown", error };
  }
};

const shipmentCall = (sourceId: number, shipment: Shipment): ShipmentCall => ({
  sender_entity_id: BigInt(sourceId),
  recipient_entity_id: BigInt(shipment.destinationId),
  resources: shipment.lines.flatMap((line) => [line.resource, BigInt(line.amount) * BigInt(RESOURCE_PRECISION)]),
});
