import type { Signer } from "../config";

export class ResourceTransactions {
  constructor(private provider: any) {}

  async send(
    signer: Signer,
    props: {
      senderEntityId: number;
      recipientEntityId: number;
      resources: { resourceType: number; amount: number }[];
    },
  ) {
    return this.provider.send_resources({
      signer,
      sender_entity_id: props.senderEntityId,
      recipient_entity_id: props.recipientEntityId,
      resources: props.resources.map((r) => ({
        resource: r.resourceType,
        amount: r.amount,
      })),
    });
  }

  async pickup(
    signer: Signer,
    props: {
      recipientEntityId: number;
      ownerEntityId: number;
      resources: { resourceType: number; amount: number }[];
    },
  ) {
    return this.provider.pickup_resources({
      signer,
      recipient_entity_id: props.recipientEntityId,
      owner_entity_id: props.ownerEntityId,
      resources: props.resources.map((r) => ({
        resource: r.resourceType,
        amount: r.amount,
      })),
    });
  }

  async claimArrivals(
    signer: Signer,
    props: {
      structureId: number;
      day: number;
      slot: number;
      resourceCount: number;
    },
  ) {
    return this.provider.arrivals_offload({
      signer,
      structureId: props.structureId,
      day: props.day,
      slot: props.slot,
      resource_count: props.resourceCount,
    });
  }
}
