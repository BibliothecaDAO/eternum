import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "@/dojo/createClientComponents";
import { useRealm } from "./useRealm";
import { useEntities } from "./useEntities";
import useLeaderBoardStore, { GuildPointsLeaderboardInterface } from "../store/useLeaderBoardStore";

export type Guild = ClientComponents["Guild"]["schema"] &
  ClientComponents["Population"]["schema"] & { name: string } & { rank: number | string };
export type GuildMember = ClientComponents["GuildMember"]["schema"] & { name: string } & {
  playerAddress: string;
};
export type GuildWhitelist = ClientComponents["GuildWhitelist"]["schema"] & { name: string } & {
  playerAddress: string;
};
export type AddressWhitelist = ClientComponents["GuildWhitelist"]["schema"] & { name: string };

export const useGuilds = () => {
  const {
    setup: {
      components: { Guild, GuildMember, GuildWhitelist, Owner, Population },
    },
    account: { account },
  } = useDojo();

  const { getEntityName } = useEntities();
  const { getAddressName } = useRealm();

  const guildPointsLeaderboard = useLeaderBoardStore((state) => state.guildPointsLeaderboard);

  const getGuildMembers = useMemo(
    () => (guildEntityId: bigint) => {
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
      const guilds = useEntityQuery([Has(Guild), NotValue(Population, { population: 0 })]);
      // const guilds = useEntityQuery([Has(Guild)]);
      return {
        guilds: formatGuilds(guilds, Guild, Population, getEntityName, guildPointsLeaderboard),
      };
    },
    [guildPointsLeaderboard],
  );

  const getGuildWhitelist = useMemo(
    () => (guildEntityId: bigint) => {
      const whitelist = useEntityQuery([
        // TODO : CONSTANT 1n
        HasValue(GuildWhitelist, { guild_entity_id: guildEntityId, is_whitelisted: 1n }),
      ]);
      return {
        whitelist: formatGuildWhitelist(whitelist, GuildWhitelist, getAddressName),
      };
    },
    [],
  );

  const getAddressWhitelist = useMemo(
    () => (address: bigint) => {
      // TODO : CONSTANT 1n
      const addressWhitelist = useEntityQuery([HasValue(GuildWhitelist, { address: address, is_whitelisted: 1n })]);
      return {
        addressWhitelist: formatAddressWhitelist(addressWhitelist, GuildWhitelist, getEntityName),
      };
    },
    [],
  );

  const getGuildOwner = useMemo(
    () => (guildEntityId: bigint) => {
      const owner = Array.from(runQuery([HasValue(Owner, { entity_id: guildEntityId })])).map((id) =>
        getComponentValue(Owner, id),
      )[0];
      return owner;
    },
    [],
  );

  const getAddressGuild = useMemo(
    () => (accountAddress: string) => {
      const userGuildEntityId = Array.from(runQuery([HasValue(GuildMember, { address: BigInt(accountAddress) })])).map(
        (id) => getComponentValue(GuildMember, id),
      )[0]?.guild_entity_id;

      const guildName = userGuildEntityId ? getEntityName(BigInt(userGuildEntityId)) : undefined;

      const owner = Array.from(
        runQuery([HasValue(Owner, { address: BigInt(accountAddress), entity_id: userGuildEntityId })]),
      ).map((id) => getComponentValue(Owner, id))[0];

      const isOwner = owner ? (owner.address === BigInt(account.address) ? true : false) : false;

      const population = Array.from(runQuery([HasValue(Guild, { entity_id: userGuildEntityId })])).map((id) =>
        getComponentValue(Population, id),
      )[0];

      return {
        userGuildEntityId,
        guildName,
        isOwner,
        ...population,
      };
    },
    [],
  );

  return { getGuilds, getGuildMembers, getGuildWhitelist, getAddressWhitelist, getAddressGuild, getGuildOwner };
};

const formatGuilds = (
  guilds: Entity[],
  Guild: Component,
  Population: Component,
  getEntityName: (entityId: bigint) => string,
  guildPointsLeaderboard: GuildPointsLeaderboardInterface[],
): Guild[] => {
  return guilds.map((guild_entity_id) => {
    const guild = getComponentValue(Guild, guild_entity_id) as ClientComponents["Guild"]["schema"];
    const population = getComponentValue(Population, guild_entity_id) as ClientComponents["Population"]["schema"];
    const name = getEntityName(BigInt(guild?.entity_id));
    const index = guildPointsLeaderboard.findIndex((item) => item.guildEntityId === BigInt(guild.entity_id));
    const rank = index != -1 ? guildPointsLeaderboard[index].rank : "";

    return {
      ...guild,
      ...population,
      rank,
      name,
    };
  });
};

const formatGuildMembers = (
  guildMembers: Entity[],
  GuildMember: Component,
  getAddressName: (address: string) => string | undefined,
): GuildMember[] => {
  return guildMembers.map((entity) => {
    const guildMember = getComponentValue(GuildMember, entity) as ClientComponents["GuildMember"]["schema"];
    const addressName = getAddressName(String(guildMember.address));
    const playerAddress = "0x" + guildMember.address.toString(16);
    return {
      ...guildMember,
      playerAddress,
      name: addressName ? addressName : "Name not found",
    };
  });
};

const formatGuildWhitelist = (
  whitelist: Entity[],
  GuildWhitelist: Component,
  getAddressName: (address: string) => string | undefined,
): GuildWhitelist[] => {
  return whitelist.map((entity) => {
    const guildWhitelist = getComponentValue(GuildWhitelist, entity) as ClientComponents["GuildWhitelist"]["schema"];
    const addressName = getAddressName(String(guildWhitelist.address));
    const playerAddress = "0x" + guildWhitelist.address.toString(16);
    return {
      ...guildWhitelist,
      playerAddress,
      name: addressName ? addressName : "player name",
    };
  });
};

const formatAddressWhitelist = (
  addressWhitelist: Entity[],
  GuildWhitelist: Component,
  getEntityName: (entityId: bigint) => string,
): AddressWhitelist[] => {
  return addressWhitelist.map((entity) => {
    const addressWhitelist = getComponentValue(GuildWhitelist, entity) as ClientComponents["GuildWhitelist"]["schema"];
    const name = getEntityName(BigInt(addressWhitelist.guild_entity_id));
    return {
      ...addressWhitelist,
      name,
    };
  });
};
