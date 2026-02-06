import type { Signer } from "../config";

export class GuildTransactions {
  constructor(private provider: any) {}

  async create(
    signer: Signer,
    props: {
      isPublic: boolean;
      guildName: string;
    },
  ) {
    return this.provider.create_guild({
      signer,
      is_public: props.isPublic,
      guild_name: props.guildName,
    });
  }

  async join(
    signer: Signer,
    props: {
      guildEntityId: number;
    },
  ) {
    return this.provider.join_guild({
      signer,
      guild_entity_id: props.guildEntityId,
    });
  }

  async leave(signer: Signer) {
    return this.provider.leave_guild({
      signer,
    });
  }

  async updateWhitelist(
    signer: Signer,
    props: {
      address: number;
      whitelist: boolean;
    },
  ) {
    return this.provider.update_whitelist({
      signer,
      address: props.address,
      whitelist: props.whitelist,
    });
  }

  async removeMember(
    signer: Signer,
    props: {
      playerAddressToRemove: number;
    },
  ) {
    return this.provider.remove_guild_member({
      signer,
      player_address_to_remove: props.playerAddressToRemove,
    });
  }

  async disband(
    signer: Signer,
    props: {
      calls: { address: number }[];
    },
  ) {
    return this.provider.disband_guild({
      signer,
      calls: props.calls,
    });
  }
}
