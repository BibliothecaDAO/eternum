import type { Signer } from "../config";
import type { BigNumberish } from "starknet";

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
      address: BigNumberish;
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
      playerAddressToRemove: BigNumberish;
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
      calls: { address: BigNumberish }[];
    },
  ) {
    return this.provider.disband_guild({
      signer,
      calls: props.calls,
    });
  }
}
