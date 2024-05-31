export const hasGuild = (guildEntityId: bigint | undefined) => {
  if (guildEntityId === 0n || guildEntityId === undefined) {
    return false;
  }
  return true;
};
