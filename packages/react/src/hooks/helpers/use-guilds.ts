import { formatGuildMembers, formatGuilds, getAddressName } from "@bibliothecadao/eternum";
import { ContractAddress, type GuildMemberInfo } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, NotValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context";

export const useGuilds = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const guilds = useEntityQuery([Has(components.Guild), NotValue(components.Guild, { member_count: 0 })]);

  return formatGuilds(guilds, ContractAddress(account.address), components);
};

export const useGuildMembers = (guildEntityId: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const guildMembers = useEntityQuery([HasValue(components.GuildMember, { guild_id: guildEntityId })]);

  return formatGuildMembers(guildMembers, ContractAddress(account.address), components);
};

export const useGuildWhitelist = (guildEntityId: ContractAddress) => {
  const {
    setup: { components },
  } = useDojo();

  const whitelist = useEntityQuery([
    HasValue(components.GuildWhitelist, {
      guild_id: guildEntityId,
      whitelisted: true,
    }),
  ]);

  return whitelist
    .map((entity) => {
      const whitelist = getComponentValue(components.GuildWhitelist, entity);
      if (!whitelist) return;
      return {
        address: whitelist.address,
        guildEntityId: Number(whitelist.guild_id),
        name: getAddressName(whitelist.address, components),
      };
    })
    .filter(Boolean) as GuildMemberInfo[];
};

export const usePlayerWhitelist = (playerAddress: ContractAddress) => {
  const {
    setup: { components },
  } = useDojo();

  const whitelist = useEntityQuery([
    HasValue(components.GuildWhitelist, {
      address: playerAddress,
      whitelisted: true,
    }),
  ]);

  return formatGuilds(whitelist, playerAddress, components);
};
