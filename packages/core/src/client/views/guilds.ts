import type { ClientComponents, ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import { type ComponentValue, type Entity, HasValue, type QueryFragment } from "@dojoengine/recs";

import { getAddressName } from "../../utils/entities";
import { formatGuildMembers } from "../../utils/guild";
import { readRows } from "./rows";

type GuildWhitelistRow = ComponentValue<ClientComponents["GuildWhitelist"]["schema"]>;

export const guildMembersQuery = (components: ClientComponents, guildEntityId: ContractAddress): QueryFragment[] => [
  HasValue(components.GuildMember, { guild_id: guildEntityId }),
];

/** isUser is relative to the viewer. */
export const readGuildMembers = (
  components: ClientComponents,
  entities: Entity[],
  viewer: ContractAddress,
): GuildMemberInfo[] => formatGuildMembers(entities, viewer, components);

/** Players a guild has invited. */
export const guildWhitelistQuery = (components: ClientComponents, guildEntityId: ContractAddress): QueryFragment[] => [
  HasValue(components.GuildWhitelist, { guild_id: guildEntityId, whitelisted: true }),
];

/** Guilds that have invited a player. */
export const playerWhitelistQuery = (components: ClientComponents, playerAddress: ContractAddress): QueryFragment[] => [
  HasValue(components.GuildWhitelist, { address: playerAddress, whitelisted: true }),
];

/**
 * A whitelist row names the invitee and the guild but carries no membership flags. The app's invite lists are typed
 * against GuildMemberInfo, so the entries keep that type as they always have: isUser and isGuildMaster are absent
 * and name is undefined for a player without a registered name.
 */
export const readGuildWhitelist = (components: ClientComponents, entities: Entity[]): GuildMemberInfo[] =>
  readRows(components.GuildWhitelist, entities).map((row) => toWhitelistEntry(components, row)) as GuildMemberInfo[];

const toWhitelistEntry = (components: ClientComponents, whitelist: GuildWhitelistRow) => ({
  address: whitelist.address,
  guildEntityId: Number(whitelist.guild_id),
  name: getAddressName(whitelist.address, components),
});
