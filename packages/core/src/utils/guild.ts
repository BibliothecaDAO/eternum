import type { ClientComponents, ContractAddress, GuildInfo, GuildMemberInfo } from "@bibliothecadao/types";

import { type Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { getAddressName } from "./entities";

export const formatGuilds = (
  guilds: Entity[],
  playerAddress: ContractAddress,
  components: ClientComponents,
): GuildInfo[] => {
  const guildMember = getComponentValue(components.GuildMember, getEntityIdFromKeys([playerAddress]));

  return guilds
    .map((guild_entity_id) => {
      const guild = getComponentValue(components.Guild, guild_entity_id);
      if (!guild) return;

      return {
        // guild id is address of the owner
        entityId: guild.guild_id,
        name: shortString.decodeShortString(guild.name.toString()),
        isOwner: guild.guild_id === playerAddress,
        memberCount: guild.member_count,
        isPublic: guild.public,
        isMember: guild.guild_id === guildMember?.guild_id,
      };
    })
    .filter((guild): guild is NonNullable<typeof guild> => guild !== undefined);
};

export const getGuild = (
  guildEntityId: ContractAddress,
  playerAddress: ContractAddress,
  components: ClientComponents,
): GuildInfo | undefined => {
  return formatGuilds([getEntityIdFromKeys([BigInt(guildEntityId)])], playerAddress, components)[0];
};

export const formatGuildMembers = (
  guildMembers: Entity[],
  playerAddress: ContractAddress,
  components: ClientComponents,
): GuildMemberInfo[] => {
  return guildMembers
    .map((entity) => {
      const guildMember = getComponentValue(components.GuildMember, entity);
      if (!guildMember) return;

      const addressName = getAddressName(guildMember.member, components);

      return {
        address: guildMember.member,
        guildEntityId: Number(guildMember.guild_id),
        name: addressName ? addressName : "Unknown",
        isUser: guildMember.member === playerAddress,
        isGuildMaster: false, // todo: fix
      };
    })
    .filter((guildMember): guildMember is NonNullable<typeof guildMember> => guildMember !== undefined);
};

export const getGuildMember = (
  playerAddress: ContractAddress,
  components: ClientComponents,
): GuildMemberInfo | undefined => {
  return formatGuildMembers([getEntityIdFromKeys([playerAddress])], playerAddress, components)[0];
};

export const getGuildFromPlayerAddress = (
  playerAddress: ContractAddress,
  components: ClientComponents,
): GuildInfo | undefined => {
  const guildMember = getComponentValue(components.GuildMember, getEntityIdFromKeys([playerAddress]));
  if (!guildMember) return;

  return getGuild(guildMember.guild_id, playerAddress, components);
};

export const getGuildMembersFromPlayerAddress = (playerAddress: ContractAddress, components: ClientComponents) => {
  const guildMember = getComponentValue(components.GuildMember, getEntityIdFromKeys([playerAddress]));
  if (!guildMember) return;

  return formatGuildMembers([getEntityIdFromKeys([BigInt(guildMember.guild_id)])], playerAddress, components);
};
