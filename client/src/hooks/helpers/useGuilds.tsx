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
import { useMemo } from "react";
import { useDojo } from "../context/DojoContext";
import useLeaderBoardStore, { GuildPointsLeaderboardInterface } from "../store/useLeaderBoardStore";
import { getEntitiesUtils } from "./useEntities";
import { useRealm } from "./useRealm";

export type GuildAndName = {
  guild: ComponentValue<ClientComponents["Guild"]["schema"]>;
  name: string;
  rank: number | string;
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

export const useGuilds = () => {
  const {
    setup: {
      components: { Guild, GuildMember, GuildWhitelist, Owner },
    },
    account: { account },
  } = useDojo();

  const { getEntityName } = getEntitiesUtils();
  const { getAddressName } = useRealm();

  const guildPointsLeaderboard = useLeaderBoardStore((state) => state.guildPointsLeaderboard);

  const getGuildMembers = useMemo(
    () => (guildEntityId: ID) => {
      const guildMembers = useEntityQuery([HasValue(GuildMember, { guild_entity_id: guildEntityId })]);
      return {
        guildMembers: formatGuildMembers(guildMembers, GuildMember, getAddressName),
      };
    },
    [],
  );

  const getGuilds = useMemo(
    () => () => {
      // TODO: CONSTANT 0n
      const guilds = useEntityQuery([Has(Guild), NotValue(Guild, { member_count: 0 })]);
      return {
        guilds: formatGuilds(guilds, Guild, getEntityName, guildPointsLeaderboard),
      };
    },
    [guildPointsLeaderboard],
  );

  const getGuildWhitelist = useMemo(
    () => (guildEntityId: ID) => {
      const whitelist = useEntityQuery([
        // TODO : CONSTANT 1n
        HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: true }),
      ]);
      return {
        whitelist: formatGuildWhitelist(whitelist, GuildWhitelist, getAddressName),
      };
    },
    [],
  );

  const getAddressWhitelist = useMemo(
    () => (address: ContractAddress) => {
      // TODO : CONSTANT 1n
      const addressWhitelist = useEntityQuery([HasValue(GuildWhitelist, { address, is_whitelisted: true })]);
      return {
        addressWhitelist: formatAddressWhitelist(addressWhitelist, GuildWhitelist, getEntityName),
      };
    },
    [],
  );

  const getGuildOwner = useMemo(
    () => (guildEntityId: ID) => {
      const owner = Array.from(runQuery([HasValue(Owner, { entity_id: guildEntityId })])).map((id) =>
        getComponentValue(Owner, id),
      )[0];
      return owner;
    },
    [],
  );

  const getAddressGuild = useMemo(
    () => (accountAddress: ContractAddress) => {
      const userGuildEntityId = Array.from(runQuery([HasValue(GuildMember, { address: accountAddress })])).map((id) =>
        getComponentValue(GuildMember, id),
      )[0]?.guild_entity_id;

      const guildName = userGuildEntityId ? getEntityName(userGuildEntityId) : undefined;

      const owner = Array.from(
        runQuery([HasValue(Owner, { address: accountAddress, entity_id: userGuildEntityId })]),
      ).map((id) => getComponentValue(Owner, id))[0];

      const isOwner = owner ? (owner.address === accountAddress ? true : false) : false;

      const memberCount = Array.from(runQuery([HasValue(Guild, { entity_id: userGuildEntityId })])).map((id) =>
        getComponentValue(Guild, id),
      )[0]?.member_count;

      return {
        userGuildEntityId,
        guildName,
        isOwner,
        memberCount,
      };
    },
    [],
  );

  return { getGuilds, getGuildMembers, getGuildWhitelist, getAddressWhitelist, getAddressGuild, getGuildOwner };
};

const formatGuilds = (
  guilds: Entity[],
  Guild: Component<ClientComponents["Guild"]["schema"]>,
  getEntityName: (entityId: ID) => string,
  guildPointsLeaderboard: GuildPointsLeaderboardInterface[],
): GuildAndName[] => {
  return guilds
    .map((guild_entity_id) => {
      const guild = getComponentValue(Guild, guild_entity_id);
      if (!guild) return;

      const name = getEntityName(guild?.entity_id);
      const index = guildPointsLeaderboard.findIndex((item) => item.guildEntityId === guild.entity_id);
      const rank = index != -1 ? guildPointsLeaderboard[index].rank : "";

      return {
        guild,
        rank,
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
