import type { ContractAddress, GuildInfo, GuildMemberInfo } from "@bibliothecadao/types";
import { shortString } from "starknet";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { configManager } from "../managers/config-manager";
import { displayPlayerName, type PlayerNameResolver } from "./entities";

export const formatGuilds = (
  guilds: Iterable<NativeRows["Guild"]>,
  playerAddress: ContractAddress,
  store: NativeFactStore,
): GuildInfo[] => {
  const game = configManager.getActiveGameId();
  const member = store.get("GuildMember", { game_id: game, actor: playerAddress });
  const members = [...store.inGame("GuildMember", game)];
  return [...guilds].map((guild) => ({
    entityId: guild.guild_id,
    name: shortString.decodeShortString(guild.name.toString()),
    isOwner: guild.guild_id === playerAddress,
    isPublic: guild.public,
    isMember: guild.guild_id === member?.guild_id,
    memberCount: members.filter((row) => row.guild_id === guild.guild_id).length,
  }));
};

export const getGuild = (
  guildEntityId: ContractAddress,
  playerAddress: ContractAddress,
  store: NativeFactStore,
): GuildInfo | undefined => {
  const guild = store.get("Guild", { game_id: configManager.getActiveGameId(), guild_id: guildEntityId });
  return guild ? formatGuilds([guild], playerAddress, store)[0] : undefined;
};

export const formatGuildMembers = (
  members: Iterable<NativeRows["GuildMember"]>,
  playerAddress: ContractAddress,
  playerName: PlayerNameResolver,
): GuildMemberInfo[] =>
  [...members].map((member) => ({
    address: member.actor,
    guildEntityId: member.guild_id,
    name: displayPlayerName(member.actor, playerName(member.actor)),
    isUser: member.actor === playerAddress,
    isGuildMaster: member.actor === member.guild_id,
  }));

export const getGuildMember = (
  playerAddress: ContractAddress,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): GuildMemberInfo | undefined => {
  const member = store.get("GuildMember", { game_id: configManager.getActiveGameId(), actor: playerAddress });
  return member ? formatGuildMembers([member], playerAddress, playerName)[0] : undefined;
};

export const getGuildFromPlayerAddress = (
  playerAddress: ContractAddress,
  store: NativeFactStore,
): GuildInfo | undefined => {
  const member = store.get("GuildMember", { game_id: configManager.getActiveGameId(), actor: playerAddress });
  return member ? getGuild(member.guild_id, playerAddress, store) : undefined;
};

export const getGuildMembersFromPlayerAddress = (
  playerAddress: ContractAddress,
  store: NativeFactStore,
  playerName: PlayerNameResolver,
): GuildMemberInfo[] => {
  const game = configManager.getActiveGameId();
  const member = store.get("GuildMember", { game_id: game, actor: playerAddress });
  return member
    ? formatGuildMembers(
        [...store.inGame("GuildMember", game)].filter((row) => row.guild_id === member.guild_id),
        playerAddress,
        playerName,
      )
    : [];
};
