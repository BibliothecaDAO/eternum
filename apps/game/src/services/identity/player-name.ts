import { shortString } from "starknet";

const MAX_SHORT_STRING_LENGTH = 31;

export const resolvePlayerName = (address: string, preferredName?: string | null): string => {
  const normalizedPreferredName = preferredName?.trim().slice(0, MAX_SHORT_STRING_LENGTH);
  if (normalizedPreferredName && shortString.isShortString(normalizedPreferredName)) {
    return normalizedPreferredName;
  }

  return `Player-${address.slice(-6)}`;
};

export const resolvePlayerNameFelt = (address: string, preferredName?: string | null): string =>
  shortString.encodeShortString(resolvePlayerName(address, preferredName));
