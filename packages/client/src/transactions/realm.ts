import type { Signer } from "../config";

export class RealmTransactions {
  constructor(private provider: any) {}

  async upgrade(
    signer: Signer,
    props: {
      realmEntityId: number;
    },
  ) {
    return this.provider.upgrade_realm({
      signer,
      realm_entity_id: props.realmEntityId,
    });
  }

  async createVillage(
    signer: Signer,
    props: {
      villagePassTokenId: number;
      connectedRealm: number;
      direction: number;
      villagePassAddress: string;
    },
  ) {
    return this.provider.create_village({
      signer,
      village_pass_token_id: props.villagePassTokenId,
      connected_realm: props.connectedRealm,
      direction: props.direction,
      village_pass_address: props.villagePassAddress,
    });
  }

  async setName(
    signer: Signer,
    props: {
      entityId: number;
      name: number;
    },
  ) {
    return this.provider.set_entity_name({
      signer,
      entity_id: props.entityId,
      name: props.name,
    });
  }

  async setPlayerName(
    signer: Signer,
    props: {
      name: number;
    },
  ) {
    return this.provider.set_address_name({
      signer,
      name: props.name,
    });
  }

  async transferOwnership(
    signer: Signer,
    props: {
      structureId: number;
      newOwner: string;
    },
  ) {
    return this.provider.transfer_structure_ownership({
      signer,
      structure_id: props.structureId,
      new_owner: props.newOwner,
    });
  }
}
