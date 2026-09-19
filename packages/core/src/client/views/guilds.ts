import type { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { displayPlayerName, getAddressName } from "../../utils/entities";
import { formatGuildMembers } from "../../utils/guild";

export const readGuildMembers = (
  store: NativeFactStore,
  guildId: ContractAddress,
  viewer: ContractAddress,
): GuildMemberInfo[] =>
  formatGuildMembers(
    [...store.inGame("GuildMember", configManager.getActiveGameId())].filter((row) => row.guild_id === guildId),
    viewer,
    store,
  );

export const readGuildWhitelist = (
  store: NativeFactStore,
  viewer: ContractAddress,
  filter: { guildId: ContractAddress } | { player: ContractAddress },
): GuildMemberInfo[] =>
  [...store.inGame("GuildWhitelist", configManager.getActiveGameId())]
    .filter(
      (row) => row.allowed && ("guildId" in filter ? row.guild_id === filter.guildId : row.player === filter.player),
    )
    .map((row) => ({
      address: row.player,
      guildEntityId: row.guild_id,
      name: displayPlayerName(row.player, getAddressName(row.player, store)),
      isUser: row.player === viewer,
      isGuildMaster: row.player === row.guild_id,
    }));
