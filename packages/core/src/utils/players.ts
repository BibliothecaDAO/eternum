import { type ClientComponents, type ContractAddress, type Player, type PlayerInfo } from "@bibliothecadao/types";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getGuild } from "./guild";
import { calculatePlayerSharePercentage } from "./leaderboard";

export const getPlayerInfo = (
  players: Player[],
  playerAddress: ContractAddress,
  playersByRank: [bigint, number][],
  playerStructureCounts: Map<
    ContractAddress,
    {
      banks: number;
      mines: number;
      realms: number;
      hyperstructures: number;
      villages: number;
    }
  >,
  components: ClientComponents,
): PlayerInfo[] => {
  const { GuildMember, Structure } = components;
  const totalPoints = playersByRank.reduce((sum, [, points]) => sum + points, 0);

  const playerInfo = players
    .map((player) => {
      // todo: fix this
      const isAlive = runQuery([HasValue(Structure, { owner: player.address })]).size > 0;

      const guildMember = getComponentValue(GuildMember, player.entity);
      const guild = getGuild(guildMember?.guild_id ?? 0n, player.address, components);

      return {
        entity: player.entity,
        address: player.address,
        name: player.name,
        isAlive,
        guildName: guild?.name,
      };
    })
    .filter((player) => player !== undefined);

  let unrankedCount = 0;

  return playerInfo.map((player) => {
    const rankIndex = playersByRank.findIndex(([address]) => address === player.address);
    if (rankIndex === -1) unrankedCount++;

    const points = rankIndex === -1 ? 0 : playersByRank[rankIndex][1];

    return {
      entity: player.entity,
      name: player.name,
      address: player.address,
      points,
      rank: rankIndex === -1 ? Number.MAX_SAFE_INTEGER : rankIndex + 1,
      percentage: calculatePlayerSharePercentage(points, totalPoints),
      lords: 0,
      realms: playerStructureCounts.get(player.address)?.realms ?? 0,
      mines: playerStructureCounts.get(player.address)?.mines ?? 0,
      hyperstructures: playerStructureCounts.get(player.address)?.hyperstructures ?? 0,
      villages: playerStructureCounts.get(player.address)?.villages ?? 0,
      banks: playerStructureCounts.get(player.address)?.banks ?? 0,
      isAlive: player.isAlive,
      guildName: player.guildName || "",
      isUser: player.address === playerAddress,
    };
  });
};
