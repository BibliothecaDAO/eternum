import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";
import { useRealm } from "./useRealm";
import { useEntities } from "./useEntities";

export type GuildAndName = ClientComponents["Guild"]["schema"] & { name: string };
export type GuildMemberAndName = ClientComponents["GuildMember"]["schema"] & { name: string };
export type GuildWhitelistAndName = ClientComponents["GuildWhitelist"]["schema"] &
  ClientComponents["Guild"]["schema"] & { name: string };
export type userGuildAndOwnership = ClientComponents["GuildMember"]["schema"] & { isOwner: boolean };
export type WhitelistElem = ClientComponents["GuildWhitelist"]["schema"] & { name: string };
export type GuildInviteAndName = ClientComponents["GuildWhitelist"]["schema"] & { name: string };

export const useGuilds = () => {
  const {
    setup: {
      components: { Guild },
    },
  } = useDojo();

  const guilds = useEntityQuery([Has(Guild)]);

  return {
    guilds: formatGuilds(guilds, Guild),
  };
};

const formatGuilds = (guilds: Entity[], Guild: Component): GuildAndName[] => {
  const { getEntityName } = useEntities();

  return guilds.map((guild_entity_id) => {
    const guild = getComponentValue(Guild, guild_entity_id) as ClientComponents["Guild"]["schema"];
    const name = getEntityName(BigInt(guild.entity_id));
    return {
      ...guild,
      name,
    };
  });
};

export const useGuildMembers = (guildEntityId: bigint) => {
  const {
    setup: {
      components: { GuildMember },
    },
  } = useDojo();

  const guildMembers = useEntityQuery([HasValue(GuildMember, { guild_entity_id: guildEntityId })]);

  return {
    guildMembers: formatGuildMembers(guildMembers, GuildMember),
  };
};

const formatGuildMembers = (guildMembers: Entity[], GuildMember: Component): GuildMemberAndName[] => {
  const { getAddressName } = useRealm();

  return guildMembers.map((entity) => {
    const guildMember = getComponentValue(GuildMember, entity) as ClientComponents["GuildMember"]["schema"];
    const addressName = getAddressName(String(guildMember.address));

    return {
      ...guildMember,
      name: addressName ? addressName : "Name not found",
    };
  });
};

export const useWhitelist = (guildEntityId: bigint) => {
  const {
    setup: {
      components: { GuildWhitelist },
    },
  } = useDojo();

  const whitelistEntities = useEntityQuery([
    HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: 1n }),
  ]);

  return {
    whitelist: formatWhitelist(whitelistEntities, GuildWhitelist),
  };
};

const formatWhitelist = (whitelist: Entity[], GuildWhitelist: Component): WhitelistElem[] => {
  const { getAddressName } = useRealm();

  return whitelist.map((entity) => {
    const guildWhitelist = getComponentValue(GuildWhitelist, entity) as ClientComponents["GuildWhitelist"]["schema"];
    const addressName = getAddressName(String(guildWhitelist.address));

    return {
      ...guildWhitelist,
      name: addressName ? addressName : "player name",
    };
  });
};

export const useGuildInvites = (address: bigint) => {
  const {
    setup: {
      components: { GuildWhitelist },
    },
  } = useDojo();

  const invites = useEntityQuery([HasValue(GuildWhitelist, { address: address, is_whitelisted: 1n })]);

  return {
    invites: formatInvites(invites, GuildWhitelist),
  };
};

const formatInvites = (invites: Entity[], GuildWhitelist: Component): GuildInviteAndName[] => {
  const { getEntityName } = useEntities();

  return invites.map((entity) => {
    const guildWhitelist = getComponentValue(GuildWhitelist, entity) as ClientComponents["GuildWhitelist"]["schema"];
    const name = getEntityName(BigInt(guildWhitelist.guild_entity_id));
    return {
      ...guildWhitelist,
      name,
    };
  });
};

export const useUserGuild = () => {
  const {
    setup: {
      components: { GuildMember, Owner },
    },
    account: { account },
  } = useDojo();

  const { getEntityName } = useEntities();

  const userGuildEntityId = getComponentValue(
    GuildMember,
    useEntityQuery([HasValue(GuildMember, { address: BigInt(account.address) })])[0],
  )?.guild_entity_id;

  const guildName = userGuildEntityId ? getEntityName(BigInt(userGuildEntityId!)) : undefined;

  const owner = getComponentValue(
    Owner,
    useEntityQuery([HasValue(Owner, { address: BigInt(account.address), entity_id: userGuildEntityId })])[0],
  );

  const isOwner = owner ? (owner.address == BigInt(account.address) ? true : false) : false;

  return {
    userGuildEntityId,
    guildName,
    isOwner,
  };
};
