import {
  ClientComponents,
  ContractAddress,
  GuildInfo,
  ID,
  PlayerInfo,
  formatGuildMembers,
  formatGuildWhitelist,
  formatGuilds,
  formatPlayerWhitelist,
  getAddressName,
  getEntityName,
  toHexString,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context";
import { useLeaderBoardStore } from "../store/use-leaderboard-store";

export const useGuilds = () => {
  const {
    setup: {
      components,
      account: { account },
    },
  } = useDojo();

  const { Guild, GuildMember, GuildWhitelist, Owner, AddressName } = components;

  const useGuildQuery = (nextBlockTimestamp: number) => {
    const guildsRanked = useLeaderBoardStore.getState().guildsByRank;
    const guilds = useEntityQuery([Has(Guild), NotValue(Guild, { member_count: 0 })]);

    return {
      guilds: formatGuilds(
        guildsRanked,
        guilds,
        nextBlockTimestamp,
        account.address,
        (entityId: number) => getEntityName(entityId, components) || "Unknown",
        components,
      ),
    };
  };

  const getGuildFromEntityId = useCallback(
    (entityId: ID, accountAddress: ContractAddress, components: ClientComponents, nextBlockTimestamp: number) => {
      const guildsRanked = useLeaderBoardStore.getState().guildsByRank;
      const guild = formatGuilds(
        guildsRanked,
        [getEntityIdFromKeys([BigInt(entityId)])],
        nextBlockTimestamp,
        account.address,
        (entityId: number) => getEntityName(entityId, components) || "Unknown",
        components,
      )[0];
      if (!guild) return;

      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(guild.entityId)]));

      return { guild, isOwner: owner?.address === ContractAddress(accountAddress), name: guild.name };
    },
    [],
  );

  const getGuildFromPlayerAddress = useCallback((accountAddress: ContractAddress): GuildInfo | undefined => {
    const guildMember = getComponentValue(GuildMember, getEntityIdFromKeys([accountAddress]));
    if (!guildMember) return;

    const guild = getComponentValue(Guild, getEntityIdFromKeys([BigInt(guildMember.guild_entity_id)]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(guildMember.guild_entity_id)]));

    const name = guildMember.guild_entity_id
      ? getEntityName(guildMember.guild_entity_id, components) || "Unknown"
      : "Unknown";

    return {
      entityId: guildMember?.guild_entity_id,
      name,
      isOwner: owner?.address === ContractAddress(accountAddress),
      memberCount: guild?.member_count || 0,
    };
  }, []);

  const useGuildMembers = (guildEntityId: ID, players: PlayerInfo[], nextBlockTimestamp: number) => {
    const guildMembers = useEntityQuery([HasValue(GuildMember, { guild_entity_id: guildEntityId })]);

    return {
      guildMembers: formatGuildMembers(
        guildMembers,
        players,
        nextBlockTimestamp,
        account.address,
        (address: ContractAddress) => getAddressName(address, components),
        components,
      ),
    };
  };

  const useGuildWhitelist = (guildEntityId: ID, players: PlayerInfo[]) => {
    const whitelist = useEntityQuery([
      HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: true }),
    ]);

    return formatGuildWhitelist(
      whitelist,
      players,
      components,
      (address: ContractAddress) => getAddressName(address, components) || "Unknown",
      (entityId: number) => getEntityName(entityId, components) || "Unknown",
    );
  };

  const usePlayerWhitelist = (address: ContractAddress) => {
    const whitelist = useEntityQuery([HasValue(GuildWhitelist, { address, is_whitelisted: true })]);

    return formatPlayerWhitelist(
      whitelist,
      components,
      (entityId: number) => getEntityName(entityId, components) || "Unknown",
    );
  };

  const getPlayersInPlayersGuild = useCallback((accountAddress: ContractAddress) => {
    const guild = getGuildFromPlayerAddress(accountAddress);
    if (!guild) return [];

    const guildEntityId = guild.entityId;
    if (typeof guildEntityId !== "number") return [];

    return getPlayerListInGuild(guildEntityId);
  }, []);

  const getPlayerListInGuild = (guild_entity_id: ID) => {
    const players = Array.from(
      runQuery([Has(AddressName), Has(GuildMember), HasValue(Guild, { entity_id: guild_entity_id })]),
    ).map((playerEntity) => {
      const player = getComponentValue(AddressName, playerEntity);

      const name = player ? shortString.decodeShortString(player.name.toString()) : "Unknown";
      const address = toHexString(player?.address || 0n);

      return {
        name,
        address,
      };
    });

    return players;
  };

  return {
    useGuildQuery,
    getGuildFromPlayerAddress,
    useGuildMembers,
    useGuildWhitelist,
    usePlayerWhitelist,
    getGuildFromEntityId,
    getPlayersInPlayersGuild,
    getPlayerListInGuild,
  };
};
