import { ID } from "@bibliothecadao/eternum";

export const hasGuild = (guildEntityId: ID | undefined) => {
  if (guildEntityId === 0 || guildEntityId === undefined) {
    return false;
  }
  return true;
};
