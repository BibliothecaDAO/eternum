import { ContractAddress, GuildMemberInfo, ID } from "../types";

import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "../dojo";
import { GuildInfo } from "../types";
import { getAddressName, getEntityName } from "./entities";

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

      const owner = getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(guild.entity_id)]));
      const name = getEntityName(guild.entity_id, components);

      return {
        entityId: guild.entity_id,
        name,
        isOwner: owner?.address === playerAddress,
        memberCount: guild.member_count,
        isPublic: guild.is_public,
        isMember: guild.entity_id === guildMember?.guild_entity_id,
      };
    })
    .filter((guild): guild is NonNullable<typeof guild> => guild !== undefined);
};

export const getGuild = (
  guildEntityId: ID,
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

      const owner = getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(guildMember.guild_entity_id)]));
      const addressName = getAddressName(guildMember.address, components);

      return {
        address: guildMember.address,
        guildEntityId: guildMember.guild_entity_id,
        name: addressName ? addressName : "Unknown",
        isUser: guildMember.address === playerAddress,
        isGuildMaster: owner?.address === guildMember.address,
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

  return getGuild(guildMember.guild_entity_id, playerAddress, components);
};

export const getGuildMembersFromPlayerAddress = (playerAddress: ContractAddress, components: ClientComponents) => {
  const guildMember = getComponentValue(components.GuildMember, getEntityIdFromKeys([playerAddress]));
  if (!guildMember) return;

  return formatGuildMembers([getEntityIdFromKeys([BigInt(guildMember.guild_entity_id)])], playerAddress, components);
};
