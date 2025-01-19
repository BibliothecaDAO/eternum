import { ContractAddress, GuildMemberInfo, GuildWhitelistInfo, PlayerInfo } from "../types";

import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "../dojo";
import { GuildInfo, ID } from "../types";
import { formatTime } from "./utils";

export const formatGuilds = (
  guildsRanked: [ID, number][],
  guilds: Entity[],
  nextBlockTimestamp: number | undefined,
  address: string,
  getEntityName: (entityId: ID) => string,
  components: ClientComponents,
  // Guild: Component<ClientComponents["Guild"]["schema"]>,
  // Owner: Component<ClientComponents["Owner"]["schema"]>,
  // GuildMember: Component<ClientComponents["GuildMember"]["schema"]>,
  // CreateGuild: Component<ClientComponents["events"]["CreateGuild"]["schema"]>,
): GuildInfo[] => {
  const guildMember = getComponentValue(components.GuildMember, getEntityIdFromKeys([ContractAddress(address)]));

  return guilds
    .map((guild_entity_id) => {
      const guild = getComponentValue(components.Guild, guild_entity_id);
      if (!guild) return;

      const owner = getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(guild.entity_id)]));
      const name = getEntityName(guild.entity_id);

      const createGuildEvent = getComponentValue(
        components.events.CreateGuild,
        getEntityIdFromKeys([BigInt(guild.entity_id)]),
      );

      let timeSinceCreation = "";
      if (createGuildEvent) {
        const guildCreationTimestamp = createGuildEvent?.timestamp ?? 0;
        timeSinceCreation = formatTime((nextBlockTimestamp || 0) - guildCreationTimestamp, undefined, true);
      }

      const rankIndex = guildsRanked.findIndex(([guildEntityId, _]) => guildEntityId === guild.entity_id);
      const hasPoints = rankIndex !== -1;

      return {
        entityId: guild.entity_id,
        name,
        isOwner: owner?.address === ContractAddress(address),
        memberCount: guild.member_count,
        rank: hasPoints ? rankIndex + 1 : Number.MAX_SAFE_INTEGER,
        points: hasPoints ? guildsRanked[rankIndex][1] : 0,
        isPublic: guild.is_public,
        age: timeSinceCreation,
        isMember: guild.entity_id === guildMember?.guild_entity_id,
      };
    })
    .filter((guild): guild is NonNullable<typeof guild> => guild !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .map((guild, index) => ({
      ...guild,
      rank: guild.rank === Number.MAX_SAFE_INTEGER ? index + 1 : guild.rank,
    }));
};

export const formatGuildMembers = (
  guildMembers: Entity[],
  players: PlayerInfo[],
  nextBlockTimestamp: number | undefined,
  userAddress: string,
  getAddressName: (address: ContractAddress) => string | undefined,
  components: ClientComponents,
  // GuildMember: Component<ClientComponents["GuildMember"]["schema"]>,
  // Owner: Component<ClientComponents["Owner"]["schema"]>,
  // JoinGuild: Component<ClientComponents["events"]["JoinGuild"]["schema"]>,
): GuildMemberInfo[] => {
  return guildMembers
    .map((entity) => {
      const guildMember = getComponentValue(components.GuildMember, entity);
      if (!guildMember) return;

      const joinGuildEvent = getComponentValue(
        components.events.JoinGuild,
        getEntityIdFromKeys([BigInt(guildMember.guild_entity_id), ContractAddress(guildMember.address)]),
      );
      const owner = getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(guildMember.guild_entity_id)]));
      const addressName = getAddressName(guildMember.address);

      const playerIndex = players.findIndex((player) => player.address === guildMember.address);
      if (playerIndex === -1) return;

      let timeSinceJoined = "";
      if (joinGuildEvent) {
        const joinGuildTimestamp = joinGuildEvent?.timestamp ?? 0;
        timeSinceJoined = formatTime((nextBlockTimestamp || 0) - joinGuildTimestamp, undefined, true);
      }

      return {
        address: guildMember.address,
        guildEntityId: guildMember.guild_entity_id,
        age: timeSinceJoined,
        name: addressName ? addressName : "Unknown",
        rank: players[playerIndex].rank,
        points: players[playerIndex].points,
        isUser: guildMember.address === ContractAddress(userAddress),
        isGuildMaster: owner?.address === guildMember.address,
      };
    })
    .filter((guildMember): guildMember is NonNullable<typeof guildMember> => guildMember !== undefined);
};

export const formatGuildWhitelist = (
  whitelist: Entity[],
  players: PlayerInfo[],
  components: ClientComponents,
  //   GuildWhitelist: Component<ClientComponents["GuildWhitelist"]["schema"]>,
  getAddressName: (address: ContractAddress) => string | undefined,
  getEntityName: (entityId: ID) => string,
): GuildWhitelistInfo[] => {
  return whitelist
    .map((entity) => {
      const guildWhitelist = getComponentValue(components.GuildWhitelist, entity);
      if (!guildWhitelist) return;

      const addressName = getAddressName(guildWhitelist.address);
      const guildName = getEntityName(guildWhitelist.guild_entity_id);
      const playerIndex = players.findIndex((player) => player.address === guildWhitelist.address);

      return {
        guildEntityId: guildWhitelist.guild_entity_id,
        name: addressName ?? "Unknown",
        guildName,
        rank: players[playerIndex].rank,
        points: players[playerIndex].points,
        address: guildWhitelist.address,
      };
    })
    .filter((guildWhitelist): guildWhitelist is NonNullable<typeof guildWhitelist> => guildWhitelist !== undefined);
};

export const formatPlayerWhitelist = (
  addressWhitelist: Entity[],
  components: ClientComponents,
  // GuildWhitelist: Component<ClientComponents["GuildWhitelist"]["schema"]>,
  getEntityName: (entityId: ID) => string,
): GuildWhitelistInfo[] => {
  return addressWhitelist
    .map((entity) => {
      const addressWhitelist = getComponentValue(components.GuildWhitelist, entity);
      if (!addressWhitelist) return;

      const guildName = getEntityName(addressWhitelist.guild_entity_id);
      return {
        guildEntityId: addressWhitelist.guild_entity_id,
        guildName,
      };
    })
    .filter(
      (addressWhitelist): addressWhitelist is NonNullable<typeof addressWhitelist> => addressWhitelist !== undefined,
    );
};
