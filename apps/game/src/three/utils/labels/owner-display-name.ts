import { displayPlayerName } from "@bibliothecadao/eternum";

const removeNullBytesAndTrim = (value?: string): string => {
  if (!value) {
    return "";
  }

  return value
    .toString()
    .split("")
    .filter((char) => char.charCodeAt(0) !== 0)
    .join("")
    .trim();
};

/**
 * A label's owner as every surface names it, by the one owner rule (`displayPlayerName`: the Vanguard for the zero
 * address, else the claimed name, else "Lord" and the last four), with a stored name's padding removed. Empty while
 * the owner's address is unknown and no name came with it.
 */
export const resolveOwnerDisplayName = (ownerName: string | undefined, ownerAddress: bigint | undefined): string => {
  const cleanedName = removeNullBytesAndTrim(ownerName);
  return ownerAddress === undefined ? cleanedName : displayPlayerName(ownerAddress.toString(), cleanedName || null);
};
