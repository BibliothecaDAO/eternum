import { type ContractAddress, type Player, type PlayerInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { displayPlayerName, type PlayerNameResolver } from "./entities";
import { getGuild } from "./guild";
import { isViewerOwner } from "./viewer";

export const getPlayerInfo = (
  players: Player[],
  playerAddress: ContractAddress,
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
  playerName: PlayerNameResolver,
): PlayerInfo[] => {
  const game_id = configManager.getActiveGameId();

  return players.map((player) => {
    const guildMember = store.get("GuildMember", { game_id, actor: player.address });
    const guild = getGuild(guildMember?.guild_id ?? 0n, player.address, store);
    const counts = playerStructureCounts.get(player.address);

    return {
      entity: player.entity,
      name: displayPlayerName(player.address, playerName(player.address)),
      address: player.address,
      realms: counts?.realms ?? 0,
      mines: counts?.mines ?? 0,
      hyperstructures: counts?.hyperstructures ?? 0,
      villages: counts?.villages ?? 0,
      banks: counts?.banks ?? 0,
      isAlive: !store.structuresOwnedBy(game_id, player.address).next().done,
      guildName: guild?.name || "",
      isUser: isViewerOwner(player.address, playerAddress),
    };
  });
};
