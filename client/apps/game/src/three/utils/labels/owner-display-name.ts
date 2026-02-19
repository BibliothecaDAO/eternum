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

export const resolveOwnerDisplayName = (
  ownerName: string | undefined,
  ownerAddress: bigint | undefined,
  unownedFallback: string,
): string => {
  const cleanedName = removeNullBytesAndTrim(ownerName);
  if (cleanedName) {
    return cleanedName;
  }

  if (ownerAddress === 0n) {
    return unownedFallback;
  }

  return "";
};

