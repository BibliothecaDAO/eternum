const toBigInt = (value: unknown): bigint | null => {
  if (!["string", "number", "bigint"].includes(typeof value)) return null;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
};

export const normalizeLeaderboardAddress = (value: unknown): string | null => {
  const parsed = toBigInt(value);
  return parsed === null || parsed <= 0n ? null : `0x${parsed.toString(16)}`;
};
