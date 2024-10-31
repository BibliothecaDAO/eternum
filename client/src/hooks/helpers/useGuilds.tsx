import { ClientComponents } from "@/dojo/createClientComponents";
import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import {
  AddressWhitelistAndName,
  GuildAndName,
  GuildFromPlayerAddress,
  GuildMemberAndName,
  GuildWhitelistAndName,
} from "@/types/guild";
import { formatTime, toHexString } from "@/ui/utils/utils";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, Entity, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { useEntitiesUtils } from "./useEntities";
import { useRealm } from "./useRealm";

export const useGuilds = () => {
  const {
    setup: {
      components: {
        Guild,
        GuildMember,
        GuildWhitelist,
        Owner,
        AddressName,
        events: { CreateGuild, JoinGuild },
      },
      account: { account },
    },
  } = useDojo();

  const { getEntityName } = useEntitiesUtils();
  const { getAddressName } = useRealm();

  const nextBlockTimestamp = useUIStore.getState().nextBlockTimestamp;

  const getPlayerList = (guild_entity_id: ID) => {
    const players = Array.from(runQuery([Has(AddressName)])).map((playerEntity) => {
      const player = getComponentValue(AddressName, playerEntity);

      const name = shortString.decodeShortString(player!.name.toString());
      const address = toHexString(player?.address || 0n);

      const isInvited = getComponentValue(
        GuildWhitelist,
        getEntityIdFromKeys([player!.address, BigInt(guild_entity_id)]),
      )?.is_whitelisted;

      return {
        name,
        address,
        isInvited: isInvited ? true : false,
      };
    });

    return players;
  };

  const getPlayerListInGuild = (guild_entity_id: ID) => {
    const players = Array.from(
      runQuery([Has(AddressName), Has(GuildMember), HasValue(Guild, { entity_id: guild_entity_id })]),
    ).map((playerEntity) => {
      const player = getComponentValue(AddressName, playerEntity);

      const name = shortString.decodeShortString(player!.name.toString());
      const address = toHexString(player?.address || 0n);

      return {
        name,
        address,
      };
    });

    return players;
  };

  const useGuildMembers = useCallback((guildEntityId: ID) => {
    const guildMembers = useEntityQuery([HasValue(GuildMember, { guild_entity_id: guildEntityId })]);

    return {
      guildMembers: formatGuildMembers(
        guildMembers,
        nextBlockTimestamp,
        account.address,
        getAddressName,
        GuildMember,
        Owner,
        JoinGuild,
      ),
    };
  }, []);

  const useGuildQuery = useCallback(() => {
    const guilds = useEntityQuery([Has(Guild), NotValue(Guild, { member_count: 0 })]);
    return {
      guilds: formatGuilds(
        guilds,
        nextBlockTimestamp,
        account.address,
        getEntityName,
        getGuildFromPlayerAddress,
        Guild,
        GuildMember,
        CreateGuild,
      ),
    };
  }, []);

  const useGuildWhitelist = (guildEntityId: ID) => {
    const whitelist = useEntityQuery([
      HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: true }),
    ]);
    return formatGuildWhitelist(whitelist, nextBlockTimestamp, GuildWhitelist, getAddressName);
  };

  const useAddressWhitelist = (address: ContractAddress) => {
    const addressWhitelist = useEntityQuery([HasValue(GuildWhitelist, { address, is_whitelisted: true })]);
    return formatAddressWhitelist(addressWhitelist, GuildWhitelist, getEntityName);
  };

  const getGuildOwner = (guildEntityId: ID) => {
    return getComponentValue(Owner, getEntityIdFromKeys([BigInt(guildEntityId)]));
  };

  const getGuildFromPlayerAddress = useCallback(
    (accountAddress: ContractAddress): GuildFromPlayerAddress | undefined => {
      const guildEntityId = getComponentValue(GuildMember, getEntityIdFromKeys([accountAddress]))?.guild_entity_id;
      if (!guildEntityId) return;

      const guildName = guildEntityId ? getEntityName(guildEntityId) : "Unknown";

      const isOwner = getGuildOwner(guildEntityId)?.address === ContractAddress(accountAddress) ? true : false;

      const memberCount = getComponentValue(Guild, getEntityIdFromKeys([BigInt(guildEntityId)]))?.member_count || 0;

      return {
        guildEntityId,
        guildName,
        isOwner,
        memberCount,
      };
    },
    [],
  );

  const getGuildFromEntityId = useCallback((entityId: ID, accountAddress: ContractAddress) => {
    const guild = formatGuilds(
      [getEntityIdFromKeys([BigInt(entityId)])],
      nextBlockTimestamp,
      account.address,
      getEntityName,
      getGuildFromPlayerAddress,
      Guild,
      GuildMember,
      CreateGuild,
    )[0];
    if (!guild) return;

    const isOwner = getGuildOwner(guild.entityId)?.address === ContractAddress(accountAddress) ? true : false;

    return { guild, isOwner, name: guild.name };
  }, []);

  const getPlayersInPlayersGuild = useCallback((accountAddress: ContractAddress) => {
    const guild = getGuildFromPlayerAddress(accountAddress);
    if (!guild) return [];

    const guildEntityId = guild.guildEntityId;
    if (typeof guildEntityId !== "number") return [];

    return getPlayerListInGuild(guildEntityId);
  }, []);

  const getCreateGuildEvent = (guildEntityId: ID) => {
    const event = getComponentValue(CreateGuild, getEntityIdFromKeys([BigInt(guildEntityId)]));
    return event;
  };

  const getGuildJoinEvent = (guildEntityId: ID, address: ContractAddress) => {
    const event = getComponentValue(JoinGuild, getEntityIdFromKeys([BigInt(guildEntityId), BigInt(address)]));
    return event;
  };

  return {
    useGuildQuery,
    useGuildMembers,
    useGuildWhitelist,
    useAddressWhitelist,
    getGuildFromPlayerAddress,
    getGuildOwner,
    getGuildFromEntityId,
    getPlayerList,
    getPlayersInPlayersGuild,
    getCreateGuildEvent,
    getGuildJoinEvent,
  };
};

const formatGuilds = (
  guilds: Entity[],
  nextBlockTimestamp: number | undefined,
  address: string,
  getEntityName: (entityId: ID) => string,
  getGuildFromPlayerAddress: (accountAddress: ContractAddress) => GuildFromPlayerAddress | undefined,
  Guild: Component<ClientComponents["Guild"]["schema"]>,
  GuildMember: Component<ClientComponents["GuildMember"]["schema"]>,
  CreateGuild: Component<ClientComponents["events"]["CreateGuild"]["schema"]>,
): GuildAndName[] => {
  const guildsByRank = LeaderboardManager.instance().getGuildsByRank(
    nextBlockTimestamp || 0,
    getGuildFromPlayerAddress,
  );

  const guildMember = getComponentValue(GuildMember, getEntityIdFromKeys([ContractAddress(address)]));

  return guilds
    .map((guild_entity_id) => {
      const guild = getComponentValue(Guild, guild_entity_id);
      if (!guild) return;

      const name = getEntityName(guild.entity_id);

      const createGuildEvent = getComponentValue(CreateGuild, getEntityIdFromKeys([BigInt(guild.entity_id)]));
      const guildCreationTimestamp = createGuildEvent?.timestamp ?? 0;
      const timeSinceCreation = formatTime((nextBlockTimestamp || 0) - guildCreationTimestamp, undefined, true);

      const index = guildsByRank.findIndex(([guildEntityId, _]) => guildEntityId === guild.entity_id);

      return {
        entityId: guild.entity_id,
        isPublic: guild.is_public,
        memberCount: guild.member_count,
        createdSince: timeSinceCreation,
        isMember: guild.entity_id === guildMember?.guild_entity_id,
        rank: "#" + (index != -1 ? String(index + 1) : "NA"),
        points: index != -1 ? guildsByRank[index][1] : 0,
        name,
      };
    })
    .filter((guild): guild is GuildAndName => guild !== undefined)
    .sort((a, b) => {
      const rankA = parseInt(a.rank.substring(1)) || Infinity;
      const rankB = parseInt(b.rank.substring(1)) || Infinity;
      return rankA - rankB;
    });
};

const formatGuildMembers = (
  guildMembers: Entity[],
  nextBlockTimestamp: number | undefined,
  userAddress: string,
  getAddressName: (address: ContractAddress) => string | undefined,
  GuildMember: Component<ClientComponents["GuildMember"]["schema"]>,
  Owner: Component<ClientComponents["Owner"]["schema"]>,
  JoinGuild: Component<ClientComponents["events"]["JoinGuild"]["schema"]>,
): GuildMemberAndName[] => {
  const playersByRank = LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp || 0);

  return guildMembers
    .map((entity) => {
      const guildMember = getComponentValue(GuildMember, entity);
      if (!guildMember) return;

      const addressName = getAddressName(guildMember.address);

      const joinGuildEvent = getComponentValue(
        JoinGuild,
        getEntityIdFromKeys([BigInt(guildMember.guild_entity_id), ContractAddress(guildMember.address)]),
      );
      const joinGuildTimestamp = joinGuildEvent?.timestamp ?? 0;
      const timeSinceJoined = formatTime((nextBlockTimestamp || 0) - joinGuildTimestamp, undefined, true);

      const index = playersByRank.findIndex(([address, _]) => address === guildMember.address);

      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(guildMember.guild_entity_id)]));

      return {
        address: guildMember.address,
        guildEntityId: guildMember.guild_entity_id,
        joinedSince: timeSinceJoined,
        name: addressName ? addressName : "Unknown",
        rank: "#" + (index != -1 ? String(index + 1) : "NA"),
        points: index != -1 ? playersByRank[index][1] : 0,
        isUser: guildMember.address === ContractAddress(userAddress),
        isGuildMaster: owner?.address === guildMember.address,
      };
    })
    .filter((guildMember): guildMember is GuildMemberAndName => guildMember !== undefined)
    .sort((a, b) => {
      const rankA = parseInt(a.rank.substring(1)) || Infinity;
      const rankB = parseInt(b.rank.substring(1)) || Infinity;
      return rankA - rankB;
    });
};

const formatGuildWhitelist = (
  whitelist: Entity[],
  nextBlockTimestamp: number | undefined,
  GuildWhitelist: Component<ClientComponents["GuildWhitelist"]["schema"]>,
  getAddressName: (address: ContractAddress) => string | undefined,
): GuildWhitelistAndName[] => {
  const playersByRank = LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp || 0);

  return whitelist
    .map((entity) => {
      const guildWhitelist = getComponentValue(GuildWhitelist, entity);
      if (!guildWhitelist) return;

      const addressName = getAddressName(guildWhitelist.address);

      const index = playersByRank.findIndex(([address, _]) => address === guildWhitelist.address);

      return {
        address: guildWhitelist.address,
        guildEntityId: guildWhitelist.guild_entity_id,
        name: addressName ? addressName : "Unknown",
        rank: "#" + (index != -1 ? String(index + 1) : "NA"),
        points: index != -1 ? playersByRank[index][1] : 0,
      };
    })
    .filter((guildWhitelist): guildWhitelist is GuildWhitelistAndName => guildWhitelist !== undefined);
};

const formatAddressWhitelist = (
  addressWhitelist: Entity[],
  GuildWhitelist: Component<ClientComponents["GuildWhitelist"]["schema"]>,
  getEntityName: (entityId: ID) => string,
): AddressWhitelistAndName[] => {
  return addressWhitelist
    .map((entity) => {
      const addressWhitelist = getComponentValue(GuildWhitelist, entity);
      if (!addressWhitelist) return;

      const name = getEntityName(addressWhitelist.guild_entity_id);
      return {
        guildEntityId: addressWhitelist.guild_entity_id,
        name,
      };
    })
    .filter((addressWhitelist): addressWhitelist is AddressWhitelistAndName => addressWhitelist !== undefined);
};
