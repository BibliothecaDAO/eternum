import type { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { displayPlayerName, type PlayerNameResolver } from "../../utils/entities";
import { formatGuildMembers } from "../../utils/guild";
import { isViewerOwner } from "../../utils/viewer";

export const readGuildMembers = (
  store: NativeFactStore,
  guildId: ContractAddress,
  viewer: ContractAddress,
  playerName: PlayerNameResolver,
): GuildMemberInfo[] =>
  formatGuildMembers(
    [...store.inGame("GuildMember", configManager.getActiveGameId())].filter((row) => row.guild_id === guildId),
    viewer,
    playerName,
  );

export const readGuildWhitelist = (
  store: NativeFactStore,
  viewer: ContractAddress,
  filter: { guildId: ContractAddress } | { player: ContractAddress },
  playerName: PlayerNameResolver,
): GuildMemberInfo[] =>
  [...store.inGame("GuildWhitelist", configManager.getActiveGameId())]
    .filter(
      (row) => row.allowed && ("guildId" in filter ? row.guild_id === filter.guildId : row.player === filter.player),
    )
    .map((row) => ({
      address: row.player,
      guildEntityId: row.guild_id,
      name: displayPlayerName(row.player, playerName(row.player)),
      isUser: isViewerOwner(row.player, viewer),
      isGuildMaster: row.player === row.guild_id,
    }));
