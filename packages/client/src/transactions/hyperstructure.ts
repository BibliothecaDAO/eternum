import type { Signer } from "../config";

export class HyperstructureTransactions {
  constructor(private provider: any) {}

  async initialize(
    signer: Signer,
    props: {
      hyperstructureId: number;
    },
  ) {
    return this.provider.initialize({
      signer,
      hyperstructure_id: props.hyperstructureId,
    });
  }

  async contribute(
    signer: Signer,
    props: {
      hyperstructureEntityId: number;
      contributorEntityId: number;
      contributions: number[];
    },
  ) {
    return this.provider.contribute_to_construction({
      signer,
      hyperstructure_entity_id: props.hyperstructureEntityId,
      contributor_entity_id: props.contributorEntityId,
      contributions: props.contributions,
    });
  }

  async allocateShares(
    signer: Signer,
    props: {
      hyperstructureEntityId: number;
      coOwners: number[][];
    },
  ) {
    return this.provider.allocate_shares({
      signer,
      hyperstructure_entity_id: props.hyperstructureEntityId,
      co_owners: props.coOwners,
    });
  }

  async setAccess(
    signer: Signer,
    props: {
      hyperstructureEntityId: number;
      access: number;
    },
  ) {
    return this.provider.set_access({
      signer,
      hyperstructure_entity_id: props.hyperstructureEntityId,
      access: props.access,
    });
  }
}
