import { ClientComponents } from "@/dojo/createClientComponents";
import { toHexString } from "@/ui/utils/utils";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import {
  Component,
  ComponentValue,
  Entity,
  Has,
  HasValue,
  NotValue,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCallback } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { useEntitiesUtils } from "./useEntities";
import { useRealm } from "./useRealm";

export type GuildAndName = {
  guild: ComponentValue<ClientComponents["Guild"]["schema"]>;
  name: string;
};

export type GuildMemberAndName = {
  guildMember: ComponentValue<ClientComponents["GuildMember"]["schema"]>;
  name: string;
  playerAddress: string;
};

export type GuildWhitelistAndName = {
  guildWhitelist: ComponentValue<ClientComponents["GuildWhitelist"]["schema"]>;
  name: string;
  playerAddress: string;
};

export type AddressWhitelistAndName = {
  addressWhitelist: ComponentValue<ClientComponents["GuildWhitelist"]["schema"]>;
  name: string;
};

export type GuildFromPlayerAddress = {
  guildEntityId: ID | undefined;
  guildName: string | undefined;
  isOwner: boolean;
  memberCount: number | undefined;
};

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
    },
  } = useDojo();

  const { getEntityName } = useEntitiesUtils();
  const { getAddressName } = useRealm();

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
      guildMembers: formatGuildMembers(guildMembers, GuildMember, getAddressName),
    };
  }, []);

  const useGuildQuery = useCallback(() => {
    const guilds = useEntityQuery([Has(Guild), NotValue(Guild, { member_count: 0 })]);
    return {
      guilds: formatGuilds(guilds, Guild, getEntityName),
    };
  }, []);

  const useGuildWhitelist = (guildEntityId: ID) => {
    const whitelist = useEntityQuery([
      HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: true }),
    ]);
    return formatGuildWhitelist(whitelist, GuildWhitelist, getAddressName);
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

      const guildName = guildEntityId ? getEntityName(guildEntityId) : undefined;

      const isOwner = getGuildOwner(guildEntityId)?.address === ContractAddress(accountAddress) ? true : false;

      const memberCount = getComponentValue(Guild, getEntityIdFromKeys([BigInt(guildEntityId)]))?.member_count;

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
    const guild = formatGuilds([getEntityIdFromKeys([BigInt(entityId)])], Guild, getEntityName)[0];
    if (!guild) return;

    const isOwner = getGuildOwner(guild.guild.entity_id)?.address === ContractAddress(accountAddress) ? true : false;

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
  Guild: Component<ClientComponents["Guild"]["schema"]>,
  getEntityName: (entityId: ID) => string,
): GuildAndName[] => {
  return guilds
    .map((guild_entity_id) => {
      const guild = getComponentValue(Guild, guild_entity_id);
      if (!guild) return;

      const name = getEntityName(guild?.entity_id);

      return {
        guild,
        name,
      };
    })
    .filter((guild): guild is GuildAndName => guild !== undefined);
};

const formatGuildMembers = (
  guildMembers: Entity[],
  GuildMember: Component<ClientComponents["GuildMember"]["schema"]>,
  getAddressName: (address: ContractAddress) => string | undefined,
): GuildMemberAndName[] => {
  return guildMembers
    .map((entity) => {
      const guildMember = getComponentValue(GuildMember, entity);
      if (!guildMember) return;
      const addressName = getAddressName(guildMember.address);
      const playerAddress = toHexString(guildMember.address);
      return {
        guildMember,
        playerAddress,
        name: addressName ? addressName : "Name not found",
      };
    })
    .filter((guildMember): guildMember is GuildMemberAndName => guildMember !== undefined);
};

const formatGuildWhitelist = (
  whitelist: Entity[],
  GuildWhitelist: Component<ClientComponents["GuildWhitelist"]["schema"]>,
  getAddressName: (address: ContractAddress) => string | undefined,
): GuildWhitelistAndName[] => {
  return whitelist
    .map((entity) => {
      const guildWhitelist = getComponentValue(GuildWhitelist, entity);
      if (!guildWhitelist) return;

      const addressName = getAddressName(guildWhitelist.address);
      const playerAddress = toHexString(guildWhitelist.address);
      return {
        guildWhitelist,
        playerAddress,
        name: addressName ? addressName : "player name",
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
        addressWhitelist,
        name,
      };
    })
    .filter((addressWhitelist): addressWhitelist is AddressWhitelistAndName => addressWhitelist !== undefined);
};
