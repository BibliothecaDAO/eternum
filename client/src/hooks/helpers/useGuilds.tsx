import { ClientComponents } from "@/dojo/createClientComponents";
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
import { getEntitiesUtils } from "./useEntities";
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
      components: { Guild, GuildMember, GuildWhitelist, Owner, AddressName },
    },
  } = useDojo();

  const { getEntityName } = getEntitiesUtils();
  const { getAddressName } = useRealm();

  const getPlayerList = (guild_entity_id: ID) => {
    const players = Array.from(runQuery([Has(AddressName)])).map((playerEntity) => {
      const player = getComponentValue(AddressName, playerEntity);

      const inviteEntity = Array.from(
        runQuery([Has(GuildWhitelist), HasValue(GuildWhitelist, { address: player?.address, guild_entity_id })]),
      )[0];

      const name = shortString.decodeShortString(player!.name.toString());
      const address = "0x" + player?.address.toString(16);
      const isInvited = getComponentValue(GuildWhitelist, inviteEntity)?.is_whitelisted;

      return {
        name,
        address,
        isInvited: isInvited ? true : false,
      };
    });

    return players;
  };

  const getGuildMembers = useCallback((guildEntityId: ID) => {
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

  const getGuildWhitelist = (guildEntityId: ID) => {
    const whitelist = useEntityQuery([
      HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: true }),
    ]);
    return formatGuildWhitelist(whitelist, GuildWhitelist, getAddressName);
  };

  const getAddressWhitelist = (address: ContractAddress) => {
    const addressWhitelist = useEntityQuery([HasValue(GuildWhitelist, { address, is_whitelisted: true })]);
    return formatAddressWhitelist(addressWhitelist, GuildWhitelist, getEntityName);
  };

  const getGuildOwner = (guildEntityId: ID) => {
    const owner = Array.from(runQuery([HasValue(Owner, { entity_id: guildEntityId })])).map((id) =>
      getComponentValue(Owner, id),
    )[0];
    return owner;
  };

  const getGuildFromPlayerAddress = useCallback(
    (accountAddress: ContractAddress): GuildFromPlayerAddress | undefined => {
      const guildEntityId = Array.from(runQuery([HasValue(GuildMember, { address: accountAddress })])).map((id) =>
        getComponentValue(GuildMember, id),
      )[0]?.guild_entity_id;

      if (!guildEntityId) return;

      const guildName = guildEntityId ? getEntityName(guildEntityId) : undefined;

      const owner = Array.from(
        runQuery([HasValue(Owner, { address: BigInt(accountAddress), entity_id: guildEntityId })]),
      ).map((id) => getComponentValue(Owner, id))[0];

      const isOwner = owner ? (owner.address === ContractAddress(accountAddress) ? true : false) : false;

      const memberCount = Array.from(runQuery([HasValue(Guild, { entity_id: guildEntityId })])).map((id) =>
        getComponentValue(Guild, id),
      )[0]?.member_count;

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

    const owner = Array.from(
      runQuery([HasValue(Owner, { address: BigInt(accountAddress), entity_id: guild.guild.entity_id })]),
    ).map((id) => getComponentValue(Owner, id))[0];

    const isOwner = owner ? (owner.address === ContractAddress(accountAddress) ? true : false) : false;
    return { guild, isOwner, name: guild.name };
  }, []);

  return {
    useGuildQuery,
    getGuildMembers,
    getGuildWhitelist,
    getAddressWhitelist,
    getGuildFromPlayerAddress,
    getGuildOwner,
    getGuildFromEntityId,
    getPlayerList,
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
      const playerAddress = "0x" + guildMember.address.toString(16);
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
      const playerAddress = "0x" + guildWhitelist.address.toString(16);
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
