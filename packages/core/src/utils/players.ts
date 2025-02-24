import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { ClientComponents } from "../dojo";
import { ContractAddress, Player, PlayerInfo } from "../types";
import { getEntityName } from "./entities";
import { calculatePlayerSharePercentage } from "./leaderboard";

export const getPlayerInfo = (
  players: Player[],
  playerAddress: ContractAddress,
  playersByRank: [bigint, number][],
  components: ClientComponents,
): PlayerInfo[] => {
  const { Realm, GuildMember, Hyperstructure, Structure } = components;

  const totalPoints = playersByRank.reduce((sum, [, points]) => sum + points, 0);

  const playerInfo = players
    .map((player) => {
      // todo: fix this
      const isAlive = runQuery([HasValue(Structure, { owner: player.address })]).size > 0;

      const guildMember = getComponentValue(GuildMember, player.entity);
      const guildName = guildMember ? getEntityName(guildMember.guild_entity_id, components) : "";

      return {
        entity: player.entity,
        address: player.address,
        name: player.name,
        isAlive,
        guildName,
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
      realms: runQuery([Has(Realm), HasValue(Structure, { owner: player.address })]).size,
      // todo: fix this if possible in efficient way
      mines: 0,
      hyperstructures: runQuery([Has(Hyperstructure), HasValue(Structure, { owner: player.address })]).size,
      isAlive: player.isAlive,
      guildName: player.guildName || "",
      isUser: player.address === playerAddress,
    };
  });
};
