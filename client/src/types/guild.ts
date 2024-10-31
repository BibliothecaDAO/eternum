import { ContractAddress, ID } from "@bibliothecadao/eternum";

export type GuildAndName = {
  entityId: ID;
  isPublic: boolean;
  memberCount: number;
  createdSince: string;
  isMember: boolean;
  rank: string;
  points: number;
  name: string;
};

export type GuildMemberAndName = {
  address: ContractAddress;
  guildEntityId: ID;
  joinedSince: string;
  name: string;
  rank: string;
  points: number;
  isUser: boolean;
  isGuildMaster: boolean;
};

export type GuildWhitelistAndName = {
  address: ContractAddress;
  guildEntityId: ID;
  joinedSince: string;
  name: string;
  rank: string;
  points: number;
};

export type AddressWhitelistAndName = {
  guildEntityId: ID;
  name: string;
};

export type GuildFromPlayerAddress = {
  guildEntityId: ID;
  guildName: string;
  isOwner: boolean;
  memberCount: number;
};

export interface SelectedGuildInterface {
  guildEntityId: ID;
  name: string;
}
