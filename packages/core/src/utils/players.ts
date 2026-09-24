import { type ContractAddress, type Player, type PlayerInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { displayPlayerName } from "./entities";
import { getGuild } from "./guild";
import { isViewerOwner } from "./viewer";

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
  store: NativeFactStore,
): PlayerInfo[] => {
  const game_id = configManager.getActiveGameId();

  const playerInfo = players
    .map((player) => {
      const isAlive = !store.structuresOwnedBy(game_id, player.address).next().done;

      const guildMember = store.get("GuildMember", { game_id, actor: player.address });
      const guild = getGuild(guildMember?.guild_id ?? 0n, player.address, store);

      return {
        entity: player.entity,
        address: player.address,
        name: displayPlayerName(player.address, player.name),
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
      realms: playerStructureCounts.get(player.address)?.realms ?? 0,
      mines: playerStructureCounts.get(player.address)?.mines ?? 0,
      hyperstructures: playerStructureCounts.get(player.address)?.hyperstructures ?? 0,
      villages: playerStructureCounts.get(player.address)?.villages ?? 0,
      banks: playerStructureCounts.get(player.address)?.banks ?? 0,
      isAlive: player.isAlive,
      guildName: player.guildName || "",
      isUser: isViewerOwner(player.address, playerAddress),
    };
  });
};
